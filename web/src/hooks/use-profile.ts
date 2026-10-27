"use client";

import { useEffect, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationOptions,
    type UseQueryOptions,
} from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useCloudinary } from "@/providers/cloudinary-provider";
import { ApiError } from "@/lib/api";
import {
    createUser,
    checkUsernameAvailability,
    getUser,
    updateUser,
    getUsers,
    type CreateUserInput,
    type UpdateUserInput,
    type User,
    type UsersResponse,
} from "@/utils/api/users";
import {
    createSocials,
    getMySocials,
    getSocials,
    updateSocials,
    type Socials,
    type SocialsInput,
} from "@/utils/api/socials";

export const profileQueryKey = ["profile", "current"] as const;
export const usersQueryKey = ["users"] as const;
export const socialsQueryKey = ["socials", "current"] as const;
export const userSocialsQueryKey = (userId: string) => ["socials", userId] as const;

export function useUsers(
    options?: Omit<UseQueryOptions<UsersResponse, Error>, "queryKey" | "queryFn">,
) {
    return useQuery({
        ...options,
        queryKey: usersQueryKey,
        queryFn: () => getUsers({ limit: 50 }),
    });
}

function missingTokenError() {
    return new Error("Your session is unavailable. Please try again.");
}

export function useMySocials() {
    const { ready, authenticated, getAccessToken } = usePrivy();

    return useQuery<Socials | null, Error>({
        queryKey: socialsQueryKey,
        enabled: ready && authenticated,
        queryFn: async () => {
            const accessToken = await getAccessToken();
            if (!accessToken) throw missingTokenError();
            return getMySocials(accessToken);
        },
    });
}

export function useSocials(userId: string | undefined) {
    const { getAccessToken } = usePrivy();

    return useQuery<Socials | null, Error>({
        queryKey: userSocialsQueryKey(userId ?? ""),
        enabled: Boolean(userId),
        queryFn: async () => {
            const accessToken = await getAccessToken();
            if (!accessToken || !userId) throw missingTokenError();
            return getSocials(accessToken, userId);
        },
    });
}

export function useCreateSocials() {
    const { getAccessToken } = usePrivy();
    const queryClient = useQueryClient();

    return useMutation<Socials, Error, SocialsInput>({
        mutationFn: async (input) => {
            const accessToken = await getAccessToken();
            if (!accessToken) throw missingTokenError();
            return createSocials(accessToken, input);
        },
        onSuccess: (socials) => queryClient.setQueryData(socialsQueryKey, socials),
    });
}

export function useUpdateSocials() {
    const { getAccessToken } = usePrivy();
    const queryClient = useQueryClient();

    return useMutation<Socials, Error, SocialsInput>({
        mutationFn: async (input) => {
            const accessToken = await getAccessToken();
            if (!accessToken) throw missingTokenError();
            return updateSocials(accessToken, input);
        },
        onSuccess: (socials) => queryClient.setQueryData(socialsQueryKey, socials),
    });
}

export function isProfileNotFound(error: unknown): error is ApiError {
    return error instanceof ApiError && error.status === 404;
}

export function useUsernameAvailability(
    username: string,
    currentUsername?: string,
) {
    const normalized = username.trim().toLowerCase();
    const [debounced, setDebounced] = useState("");
    const isCurrentUsername =
        normalized === currentUsername?.trim().toLowerCase();

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebounced(normalized), 400);
        return () => window.clearTimeout(timeout);
    }, [normalized]);

    return {
        isCurrentUsername,
        ...useQuery({
            queryKey: ["username-availability", debounced],
            queryFn: () => checkUsernameAvailability(debounced),
            enabled: debounced.length >= 3 && !isCurrentUsername,
            staleTime: 30_000,
            retry: false,
        }),
    };
}

export function useProfile(
    options?: Omit<
        UseQueryOptions<User, Error, User, typeof profileQueryKey>,
        "queryKey" | "queryFn"
    > & { enabled?: boolean },
) {
    const { ready, authenticated, getAccessToken } = usePrivy();

    return useQuery({
        ...options,
        queryKey: profileQueryKey,
        enabled: ready && authenticated && (options?.enabled ?? true),
        queryFn: async () => {
            const accessToken = await getAccessToken();
            if (!accessToken) throw missingTokenError();
            return getUser(accessToken);
        },
    });
}

export function useCreateProfile(
    options?: Omit<
        UseMutationOptions<User, Error, CreateUserInput>,
        "mutationFn"
    >,
) {
    const queryClient = useQueryClient();
    const { getAccessToken } = usePrivy();
    const { uploadImage } = useCloudinary();

    return useMutation({
        ...options,
        mutationFn: async (input: CreateUserInput) => {
            const accessToken = await getAccessToken();
            if (!accessToken) throw missingTokenError();
            const avatar =
                input.avatar instanceof File
                    ? await uploadImage(input.avatar)
                    : input.avatar;
            return createUser(accessToken, { ...input, avatar });
        },
        onSuccess: async (profile, variables, onMutateResult, context) => {
            queryClient.setQueryData(profileQueryKey, profile);
            await options?.onSuccess?.(
                profile,
                variables,
                onMutateResult,
                context,
            );
        },
    });
}

export function useUpdateProfile(
    options?: Omit<
        UseMutationOptions<
            User,
            Error,
            Omit<UpdateUserInput, "avatar"> & { avatar?: File | string }
        >,
        "mutationFn"
    >,
) {
    const queryClient = useQueryClient();
    const { getAccessToken } = usePrivy();
    const { uploadImage } = useCloudinary();

    return useMutation({
        ...options,
        mutationFn: async (
            input: Omit<UpdateUserInput, "avatar"> & { avatar?: File | string },
        ) => {
            const accessToken = await getAccessToken();
            if (!accessToken) throw missingTokenError();
            const { avatar: avatarInput, ...profileInput } = input;
            const avatar = avatarInput instanceof File
                ? await uploadImage(avatarInput)
                : avatarInput;
            return updateUser(accessToken, {
                ...profileInput,
                ...(avatar ? { avatar } : {}),
            });
        },
        onSuccess: async (profile, variables, onMutateResult, context) => {
            queryClient.setQueryData(profileQueryKey, profile);
            await options?.onSuccess?.(
                profile,
                variables,
                onMutateResult,
                context,
            );
        },
    });
}

export function useClearProfile() {
    const queryClient = useQueryClient();
    const { logout } = usePrivy();

    return async () => {
        await logout();
        queryClient.removeQueries({ queryKey: profileQueryKey });
    };
}
