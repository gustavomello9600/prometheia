"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    console.log('Attempting login with:', { email });
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      console.log('SignIn result:', result);
      if (result?.error) {
        setError(result.error);
        console.error('Login error:', result.error);
      } else {
        console.log('Login successful, redirecting...');
        router.push('/home');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Login error:', error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-center">Login to AI Agent</h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input 
              id="email"
              type="email" 
              placeholder="Enter your email" 
              className="w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="font-medium">Password</label>
            <div className="relative">
              <Input 
                id="password"
                type={showPassword ? "text" : "password"} 
                placeholder="Enter your password" 
                className="w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="text-red-500 text-sm mt-2">
              {error}
            </div>
          )}
          <div className="flex items-center">
            <input 
              id="remember-me"
              type="checkbox" 
              className="h-4 w-4 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm">Remember me</label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button className="w-full font-medium" onClick={handleLogin}>
            <LogIn className="mr-2 h-4 w-4" /> Log In
          </Button>
          <p className="text-sm text-center">
            Don't have an account? <Link href="/create-account" className="hover:underline hover:text-accent-foreground">Sign up</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}