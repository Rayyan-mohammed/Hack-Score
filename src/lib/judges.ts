// Shared between the Judges page and its server actions. It can't live in
// actions.ts: a "use server" module may only export async functions.

/** Value the Judge dropdown uses for "assign every judge at once". */
export const ALL_JUDGES = "__all";
