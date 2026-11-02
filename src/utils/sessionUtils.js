export async function restoreSessionUser(auth, storedUser) {
  if (!auth || !storedUser?.id) return null;

  const { data, error } = await auth.getSession();
  if (error) throw error;

  return data.session?.user?.id === storedUser.id ? storedUser : null;
}
