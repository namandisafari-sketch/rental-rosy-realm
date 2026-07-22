import { useState } from "react"

const slides = [
  {
    icon: "H",
    title: "Welcome to Habico",
    subtitle: "Elevate the Value of Your Residences",
    body: "The all-in-one platform for property managers, landlords, and tenants. Manage, track, and grow — all from one place.",
  },
  {
    icon: "🏠",
    title: "Manage Everything",
    subtitle: "Properties, Tenants & Finances",
    body: "Track rent payments, manage maintenance requests, communicate with tenants, and generate reports — all in real time.",
  },
  {
    icon: "📊",
    title: "Smart Insights",
    subtitle: "Data-Driven Decisions",
    body: "Get clear dashboards with occupancy rates, revenue trends, and expense tracking. Know your portfolio inside out.",
  },
]

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)

  function next() {
    if (step < slides.length - 1) {
      setStep(step + 1)
    } else {
      onDone()
    }
  }

  function skip() {
    onDone()
  }

  const s = slides[step]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex justify-end p-4">
        <button onClick={skip} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Skip
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        {step === 0 ? (
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-teal-500 to-emerald-600 text-5xl font-black text-white shadow-lg">
            H
          </div>
        ) : (
          <div className="mb-8 text-7xl">{s.icon}</div>
        )}
        <h2 className="text-2xl font-bold text-foreground">{s.title}</h2>
        <p className="mt-2 text-sm font-medium text-teal-500">{s.subtitle}</p>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{s.body}</p>
      </div>

      <div className="px-8 pb-2">
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-teal-500" : "w-2 bg-muted-foreground/20"}`}
            />
          ))}
        </div>
      </div>

      <div className="px-8 pb-12 pt-6">
        <button
          onClick={next}
          className="flex w-full items-center justify-center rounded-xl bg-teal-500 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-teal-600 active:scale-[0.98]"
        >
          {step < slides.length - 1 ? "Next" : "Get Started"}
        </button>
      </div>
    </div>
  )
}
