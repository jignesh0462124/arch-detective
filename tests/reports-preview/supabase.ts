export const isSupabaseConfigured = true;
export const supabase = {
  auth: {
    getSession: async () => ({
      data: { session: { access_token: "isolated-token", user: { id: "fixture-user" } } },
      error: null,
    }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
};
