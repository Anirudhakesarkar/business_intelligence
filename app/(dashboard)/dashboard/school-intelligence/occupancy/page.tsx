'use client';
import { redirect } from 'next/navigation';
export default function OccupancyRedirect() {
  redirect('/dashboard/school-intelligence/student-occupancy');
}
