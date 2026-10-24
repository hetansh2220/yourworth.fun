use crate::{errors::WorthError, events::*, state::*};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
#[instruction(order_id: [u8; 32], amount_base_units: u64, authority_epoch: u64)]
pub struct CreateOrder<'info> {
    #[account(seeds = [b"config"], bump = config.bump,
        constraint = config.admin == admin.key() @ WorthError::UnauthorizedAdmin,
        constraint = config.authority_epoch == authority_epoch @ WorthError::StaleAuthorityEpoch)]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: This immutable payout identity is approved by buyer + admin; never read as data.
    pub creator: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = buyer, token::token_program = token_program)]
    pub source: Account<'info, TokenAccount>,
    #[account(init, payer = buyer, space = 8 + Order::INIT_SPACE, seeds = [b"order", order_id.as_ref()], bump)]
    pub order: Account<'info, Order>,
    #[account(init, payer = buyer, seeds = [b"vault", order_id.as_ref()], bump,
        token::mint = mint, token::authority = order, token::token_program = token_program)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(authority_epoch: u64)]
pub struct SettleOrder<'info> {
    #[account(seeds = [b"config"], bump = config.bump,
        constraint = config.admin == admin.key() @ WorthError::UnauthorizedAdmin,
        constraint = config.authority_epoch == authority_epoch @ WorthError::StaleAuthorityEpoch)]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut, seeds = [b"order", order.order_id.as_ref()], bump = order.bump,
        has_one = mint, constraint = order.status == OrderStatus::Funded @ WorthError::AlreadySettled)]
    pub order: Account<'info, Order>,
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"vault", order.order_id.as_ref()], bump,
        token::mint = mint, token::authority = order, token::token_program = token_program,
        constraint = vault.delegate.is_none() && vault.close_authority.is_none() @ WorthError::InvalidVaultAuthority)]
    pub vault: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = participant,
        associated_token::mint = mint, associated_token::authority = participant,
        associated_token::token_program = token_program)]
    pub destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn create(
    ctx: Context<CreateOrder>,
    order_id: [u8; 32],
    amount: u64,
    _epoch: u64,
    expires_at: i64,
) -> Result<()> {
    require!(amount > 0, WorthError::InvalidAmount);
    require!(
        expires_at > Clock::get()?.unix_timestamp,
        WorthError::InvalidExpiry
    );
    let a = &ctx.accounts;
    require!(
        a.buyer.key() != a.creator.key()
            && a.buyer.key() != a.admin.key()
            && a.creator.key() != a.admin.key(),
        WorthError::ConflictingRoles
    );
    require!(
        a.creator.key() != Pubkey::default(),
        WorthError::WrongParticipant
    );
    token::transfer_checked(
        CpiContext::new(
            a.token_program.to_account_info(),
            TransferChecked {
                from: a.source.to_account_info(),
                mint: a.mint.to_account_info(),
                to: a.vault.to_account_info(),
                authority: a.buyer.to_account_info(),
            },
        ),
        amount,
        a.mint.decimals,
    )?;
    let buyer = a.buyer.key();
    let creator = a.creator.key();
    let mint = a.mint.key();
    ctx.accounts.order.set_inner(Order {
        order_id,
        buyer,
        creator,
        mint,
        principal: amount,
        decimals: ctx.accounts.mint.decimals,
        status: OrderStatus::Funded,
        expires_at,
        bump: ctx.bumps.order,
    });
    emit!(OrderFunded {
        order_id,
        buyer,
        creator,
        mint,
        principal: amount,
        expires_at,
    });
    Ok(())
}

pub fn settle(ctx: Context<SettleOrder>, refund: bool) -> Result<()> {
    let a = &ctx.accounts;
    validate_settlement_time(Clock::get()?.unix_timestamp, a.order.expires_at, refund)?;
    let expected = if refund {
        a.order.buyer
    } else {
        a.order.creator
    };
    require_keys_eq!(a.participant.key(), expected, WorthError::WrongParticipant);
    require!(
        a.admin.key() != a.order.buyer && a.admin.key() != a.order.creator,
        WorthError::ConflictingRoles
    );
    require!(
        a.vault.amount >= a.order.principal,
        WorthError::InsufficientEscrow
    );
    let bump = [a.order.bump];
    let seeds: &[&[u8]] = &[b"order", &a.order.order_id, &bump];
    token::transfer_checked(
        CpiContext::new_with_signer(
            a.token_program.to_account_info(),
            TransferChecked {
                from: a.vault.to_account_info(),
                mint: a.mint.to_account_info(),
                to: a.destination.to_account_info(),
                authority: a.order.to_account_info(),
            },
            &[seeds],
        ),
        a.order.principal,
        a.order.decimals,
    )?;
    let order = &mut ctx.accounts.order;
    order.status = if refund {
        OrderStatus::Refunded
    } else {
        OrderStatus::Paid
    };
    emit!(OrderSettled {
        order_id: order.order_id,
        status: order.status,
        principal: order.principal
    });
    Ok(())
}

fn validate_settlement_time(now: i64, expires_at: i64, refund: bool) -> Result<()> {
    if refund {
        require!(now >= expires_at, WorthError::OrderNotExpired);
    } else {
        require!(now < expires_at, WorthError::OrderExpired);
    }
    Ok(())
}

#[cfg(test)]
mod expiry_tests {
    use super::*;

    #[test]
    fn payout_is_allowed_only_strictly_before_expiry() {
        assert!(validate_settlement_time(99, 100, false).is_ok());
        assert!(validate_settlement_time(100, 100, false).is_err());
        assert!(validate_settlement_time(101, 100, false).is_err());
    }

    #[test]
    fn refund_is_allowed_at_and_after_expiry() {
        assert!(validate_settlement_time(99, 100, true).is_err());
        assert!(validate_settlement_time(100, 100, true).is_ok());
        assert!(validate_settlement_time(101, 100, true).is_ok());
    }
}
