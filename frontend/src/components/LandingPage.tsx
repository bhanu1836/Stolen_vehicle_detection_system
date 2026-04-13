import { AlertTriangle, Car, CheckCircle2, Database, Lock, MapPin, Shield, Smartphone, Users, Zap } from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#0d1b2a] to-[#1a3a52]">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-blue-900/30 bg-gradient-to-b from-blue-950/40 to-transparent px-6 py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-600/50 bg-blue-900/20 px-4 py-2">
              <Zap className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Next-Gen Vehicle Intelligence Platform</span>
            </div>
            <h1 className="mb-6 text-center text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Smart Plate AI
            </h1>
            <p className="mx-auto mb-4 max-w-2xl text-lg text-blue-200/90 sm:text-xl">
              Real-time stolen vehicle detection and recovery using advanced AI-powered number plate recognition. 
              Connecting citizens, law enforcement, and technology for safer communities.
            </p>
            <div className="mb-8 flex flex-wrap justify-center gap-4">
              <button
                onClick={onLogin}
                className="rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white transition hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/50"
              >
                Sign In / Register
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="border-b border-blue-900/30 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-white sm:text-4xl">
            Advanced Capabilities
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <Smartphone className="h-8 w-8" />,
                title: "Easy Reporting",
                desc: "Citizens file theft reports instantly with vehicle details and location tracking"
              },
              {
                icon: <Zap className="h-8 w-8" />,
                title: "Real-Time Detection",
                desc: "AI scans traffic cameras continuously, matching plates against stolen vehicles database"
              },
              {
                icon: <AlertTriangle className="h-8 w-8" />,
                title: "Instant Alerts",
                desc: "Police units receive live notifications when stolen vehicles are detected"
              },
              {
                icon: <MapPin className="h-8 w-8" />,
                title: "Location Tracking",
                desc: "GPS-enabled camera networks provide precise detection coordinates and timestamps"
              },
              {
                icon: <Database className="h-8 w-8" />,
                title: "Centralized Database",
                desc: "National stolen vehicle registry with integrated case management and verification"
              },
              {
                icon: <Lock className="h-8 w-8" />,
                title: "Secure & Private",
                desc: "Government-grade encryption protects citizen data and investigation details"
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="rounded-lg border border-blue-700/40 bg-gradient-to-br from-blue-950/50 to-slate-900/30 p-6 transition hover:border-blue-600/60 hover:bg-blue-950/40"
              >
                <div className="mb-4 inline-flex rounded-lg bg-blue-900/30 p-3 text-blue-400">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="text-sm text-slate-300">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow Section */}
      <div className="border-b border-blue-900/30 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-white sm:text-4xl">
            How It Works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                number: "1",
                title: "Report Theft",
                desc: "Citizens report stolen vehicles with registration number, type, color, and last location"
              },
              {
                number: "2",
                title: "Auto-Detection",
                desc: "AI-powered cameras across the network continuously scan number plates in real-time"
              },
              {
                number: "3",
                title: "Police Response",
                desc: "Matching detections trigger immediate case creation and alert dispatch to police units"
              },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-2xl font-bold text-white">
                  {step.number}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-white">{step.title}</h3>
                <p className="text-slate-300">{step.desc}</p>
                {i < 2 && (
                  <div className="absolute right-0 top-6 hidden h-1 w-full translate-x-1/2 bg-gradient-to-r from-blue-500 to-transparent md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="border-b border-blue-900/30 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Active Cases", value: "2,847" },
              { label: "Vehicles Recovered", value: "1,243" },
              { label: "Camera Network", value: "8,500+" },
              { label: "Police Stations", value: "450+" },
            ].map((stat, i) => (
              <div key={i} className="rounded-lg border border-blue-700/40 bg-blue-950/30 p-6 text-center">
                <p className="mb-2 text-4xl font-bold text-blue-400">{stat.value}</p>
                <p className="text-slate-300">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Types */}
      <div className="border-b border-blue-900/30 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-white sm:text-4xl">
            Roles & Responsibilities
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: <Users className="h-10 w-10" />,
                role: "Citizens",
                color: "from-blue-500 to-cyan-600",
                tasks: ["Report stolen vehicles", "Track case status", "Receive notifications", "Provide updates"]
              },
              {
                icon: <AlertTriangle className="h-10 w-10" />,
                role: "Police Officers",
                color: "from-amber-500 to-orange-600",
                tasks: ["Investigate cases", "Respond to detections", "Update case status", "Close investigations"]
              },
              {
                icon: <Shield className="h-10 w-10" />,
                role: "Administrators",
                color: "from-red-500 to-pink-600",
                tasks: ["System monitoring", "AI calibration", "Staff management", "Analytics review"]
              },
            ].map((role, i) => (
              <div key={i} className="rounded-lg border border-blue-700/40 bg-blue-950/30 p-6">
                <div className={`mb-4 inline-flex rounded-lg bg-gradient-to-br ${role.color} p-3 text-white`}>
                  {role.icon}
                </div>
                <h3 className="mb-4 text-xl font-semibold text-white">{role.role}</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  {role.tasks.map((task, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl text-center">
          <div className="mb-8 rounded-2xl border border-blue-600/50 bg-gradient-to-r from-blue-950/50 to-slate-900/50 p-8">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">
              Ready to Help?
            </h2>
            <p className="mb-6 text-slate-300">
              Join the network of concerned citizens helping recover stolen vehicles and supporting law enforcement.
            </p>
            <button
              onClick={onLogin}
              className="rounded-lg bg-blue-500 px-8 py-3 font-semibold text-white transition hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/50"
            >
              Sign In or Register Now
            </button>
          </div>
          <p className="text-sm text-slate-400">
            For emergencies, always call 112 | Platform maintained by National Transportation & Safety Authority
          </p>
        </div>
      </div>
    </div>
  );
}
