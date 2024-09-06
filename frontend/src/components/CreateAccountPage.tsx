"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { register } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import axios from 'axios';

export default function CreateAccountPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    try {
      console.log('Attempting to register with email:', email);
      const response = await register(email, password, name);
      console.log('Register response:', response);
      if (response.success) {
        alert('Account created successfully. Please log in.');
        router.push('/login');
      } else {
        alert(response.message || "Failed to create account. Please try again.");
      }
    } catch (error) {
      console.error('Registration error:', error);
      if (axios.isAxiosError(error) && error.response) {
        alert(`Server error: ${error.response.data.message || error.message}`);
      } else {
        alert(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-4">
      <form onSubmit={handleCreateAccount}>
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-2xl font-bold text-center">Create an Account</h1>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Full Name</label>
              <Input 
                id="name"
                type="text" 
                placeholder="Enter your full name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input 
                id="email"
                type="email" 
                placeholder="Enter your email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input 
                  id="password"
                  type={showPassword ? "text" : "password"} 
                  placeholder="Create a password" 
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
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</label>
              <div className="relative">
                <Input 
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"} 
                  placeholder="Confirm your password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center">
              <input 
                id="terms"
                type="checkbox" 
                className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-primary"
              />
              <label htmlFor="terms" className="ml-2 block text-sm">
                I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              </label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full">
              <UserPlus className="mr-2 h-4 w-4" /> Create Account
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account? <Link href="/login" className="text-primary hover:underline">Log in</Link>
            </p>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}