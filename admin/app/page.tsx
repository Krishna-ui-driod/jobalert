import { redirect } from 'next/navigation'

// Root "/" → redirect to login (middleware will redirect to /admin/dashboard if already logged in)
export default function RootPage() {
  redirect('/login')
}
