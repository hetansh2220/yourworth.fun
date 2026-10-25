export type AppVariables = {
  walletAddress: string;
  currentUserId: string;
  chatId: string;
  chatType: "DM" | "GROUP";
  chatAdminId: string;
};

export type AppEnv = {
  Variables: AppVariables;
};
