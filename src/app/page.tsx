// src/app/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { FaCheckCircle, FaBroom, FaMoneyBillWave, FaUsers, FaComments } from 'react-icons/fa';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-gray-800">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-emerald-800">Roomies</h1>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-gray-700 hover:text-emerald-600">
            Log in
          </Link>
          <Link href="/register" className="bg-emerald-700 hover:bg-emerald-800 text-white py-2 px-4 rounded-md">
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-6 py-12 md:py-24 flex flex-col md:flex-row items-center">
        <div className="md:w-1/2 mb-12 md:mb-0">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            Roommate living
            <br />
            made easy
          </h2>
          <div className="space-y-4 mb-8">
            {[
              'Split bills and settle up with a shared ledger',
              'Assign tasks and keep everyone accountable',
              'One chat for the whole household',
            ].map((line) => (
              <div key={line} className="flex items-center">
                <FaCheckCircle className="text-emerald-500 mr-2 flex-shrink-0" />
                <p className="text-gray-700">{line}</p>
              </div>
            ))}
          </div>
          <Link
            href="/register"
            className="bg-emerald-700 hover:bg-emerald-800 text-white py-3 px-6 rounded-md text-lg font-medium inline-block"
          >
            Create your household
          </Link>
        </div>
        <div className="md:w-1/2">
          <div className="relative h-80 w-full">
            <Image src="/roommate-dashboard.png" alt="Roomies dashboard preview" fill className="object-contain rounded-lg shadow-lg" priority />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-16">Everything a shared home needs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: FaMoneyBillWave, title: 'Bill splitting', text: 'Log an expense, split it equally, by percentage or custom amounts, and see who owes whom.' },
              { icon: FaBroom, title: 'Tasks', text: 'Create chores and to-dos, assign them, set priorities and due dates, and tick them off.' },
              { icon: FaUsers, title: 'Households', text: 'Invite roommates by email or share a join code. Admins manage members and settings.' },
              { icon: FaComments, title: 'Chat', text: 'A real-time group chat for the household, right next to the money and the chores.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex flex-col items-center text-center">
                <div className="bg-neutral-100 p-6 rounded-full mb-4">
                  <Icon className="text-4xl text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{title}</h3>
                <p className="text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-700 py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to simplify roommate living?</h2>
          <p className="text-white text-lg mb-8 max-w-2xl mx-auto">Set up your household in a couple of minutes and invite your roommates.</p>
          <Link href="/register" className="bg-white text-emerald-700 py-3 px-8 rounded-md text-lg font-medium hover:bg-neutral-100">
            Get started free
          </Link>
        </div>
      </section>

      <footer className="bg-neutral-800 text-white py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-2xl font-bold">Roomies</h3>
            <p className="text-neutral-300">The complete solution for managing your shared living space.</p>
          </div>
          <p className="text-neutral-400">&copy; {new Date().getFullYear()} Roomies</p>
        </div>
      </footer>
    </div>
  );
}
