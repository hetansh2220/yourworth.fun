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
    type CreateUserInput,
    type UpdateUserInput,
    type User,
} from "@/utils/api/users";

export const profileQueryKey = ["profile", "current"] as const;

function missingTokenError() {
    return new Error("Your session is unavailable. Please try again.");
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
        UseMutationOptions<User, Error, UpdateUserInput>,
        "mutationFn"
    >,
) {
    const queryClient = useQueryClient();
    const { getAccessToken } = usePrivy();

    return useMutation({
        ...options,
        mutationFn: async (input: UpdateUserInput) => {
            const accessToken = await getAccessToken();
            if (!accessToken) throw missingTokenError();
            return updateUser(accessToken, input);
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
