import { Redirect } from 'expo-router';

// Deep link target after Google sign-in; the session is handled by googleAuth.ts.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
