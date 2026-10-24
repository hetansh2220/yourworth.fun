use crate::{errors::WorthError, events::*, program::Worth, state::Config};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(init, payer = authority, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ WorthError::InvalidProgramData)]
    pub program: Program<'info, Worth>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ WorthError::UnauthorizedUpgradeAuthority)]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ WorthError::InvalidProgramData)]
    pub program: Program<'info, Worth>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ WorthError::UnauthorizedUpgradeAuthority)]
    pub program_data: Account<'info, ProgramData>,
}

pub fn initialize(ctx: Context<InitializeConfig>, admin: Pubkey) -> Result<()> {
    require!(admin != Pubkey::default(), WorthError::InvalidAdmin);
    ctx.accounts.config.set_inner(Config {
        admin,
        authority_epoch: 0,
        bump: ctx.bumps.config,
    });
    emit!(ConfigInitialized { admin });
    Ok(())
}

pub fn update(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    require!(
        new_admin != Pubkey::default() && new_admin != config.admin,
        WorthError::InvalidAdmin
    );
    let old_admin = config.admin;
    config.authority_epoch = config
        .authority_epoch
        .checked_add(1)
        .ok_or(WorthError::ArithmeticOverflow)?;
    config.admin = new_admin;
    emit!(AdminUpdated {
        old_admin,
        new_admin,
        authority_epoch: config.authority_epoch
    });
    Ok(())
}
