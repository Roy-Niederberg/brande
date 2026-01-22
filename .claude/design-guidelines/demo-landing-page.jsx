export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation - Clean with subtle border */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-gray-900">ProductName</div>
            <div className="flex items-center gap-8">
              <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">
                Features
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">
                Pricing
              </a>
              <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Generous spacing, clear hierarchy */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Build Better Products Faster
          </h1>
          <p className="text-xl text-gray-600 mb-12 leading-relaxed">
            A modern platform that helps teams collaborate, ship features quickly, 
            and deliver exceptional user experiences.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm">
              Start Free Trial
            </button>
            <button className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors">
              View Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Section - Card grid with consistent spacing */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-16 text-center">
            Everything You Need
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature Card 1 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Lightning Fast
              </h3>
              <p className="text-gray-600">
                Built for speed from the ground up. Your users will notice the difference.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Secure by Default
              </h3>
              <p className="text-gray-600">
                Enterprise-grade security with encryption at rest and in transit.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Fully Customizable
              </h3>
              <p className="text-gray-600">
                Adapt the platform to your workflow, not the other way around.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section - Proper input styling and spacing */}
      <section className="py-24 px-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Get Early Access
            </h2>
            <p className="text-gray-600 mb-8">
              Join our waitlist and be the first to know when we launch.
            </p>
            
            <form className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-shadow"
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-shadow"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Company
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-shadow"
                  placeholder="Acme Inc."
                />
              </div>

              <button 
                type="submit"
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm font-medium"
              >
                Join Waitlist
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer - Minimal with proper spacing */}
      <footer className="bg-white border-t border-gray-200 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-600">
              © 2024 ProductName. All rights reserved.
            </div>
            <div className="flex gap-8">
              <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">
                Privacy
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">
                Terms
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
