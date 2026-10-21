export const isSupabaseConfigured = true;
export const supabase = {
  auth: {
    getSession: async () => ({
      data: { session: { access_token: "isolated-ui-fixture-not-a-real-token" } },
      error: null,
    }),
  },
};
