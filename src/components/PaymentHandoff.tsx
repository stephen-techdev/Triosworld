import { Check, Loader2, Lock, PackageCheck, ShieldCheck, Smartphone } from 'lucide-react';
import { formatINR } from '@/data/catalog';

export type HandoffStepState = 'done' | 'active' | 'pending';

export interface HandoffStep {
  label: string;
  state: HandoffStepState;
}

interface PaymentHandoffProps {
  title: string;
  subtitle: string;
  amount: number;
  itemCount: number;
  thumbnails?: string[];
  steps: HandoffStep[];
  /** The small uppercase line under the progress bar, e.g. "Step 1 of 2". */
  progressLabel?: string;
  /** Defaults to the keep-this-page-open reassurance. */
  note?: string;
}

/**
 * The screen between "Pay securely" and Razorpay's own window.
 *
 * It is deliberately a full-screen overlay, mounted on the very next frame
 * after the tap: the customer gets an immediate, honest answer while the order
 * is created and the secure checkout is fetched. It is shared by the checkout
 * page (creating the order) and the order page (opening Razorpay), so both
 * steps look and feel like one continuous hand-off.
 *
 * Razorpay itself renders far above this overlay, so it stays behind the
 * payment sheet and disappears when Razorpay reports success or dismissal.
 */
export default function PaymentHandoff({
  title,
  subtitle,
  amount,
  itemCount,
  thumbnails = [],
  steps,
  progressLabel,
  note = 'Keep this page open — it updates by itself.',
}: PaymentHandoffProps) {
  const thumbs = thumbnails.filter(Boolean).slice(0, 3);

  return (
    <div
      className="payment-handoff fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#f7f5f0]/95 px-5 py-8 backdrop-blur-[3px]"
      style={{ touchAction: 'none' }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="payment-handoff__card relative w-full max-w-[22rem] overflow-hidden rounded-[28px] border border-ink/10 bg-ivory px-6 pb-5 pt-6 shadow-[0_28px_80px_-24px_rgba(23,23,23,0.45)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-lime/0 via-lime to-lime/0" />

        <div className="flex items-start gap-3.5">
          <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink text-ivory shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-ivory/15 border-t-lime [animation-duration:1.6s]" />
            <Lock size={20} strokeWidth={2.2} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/45">
              Secure hand-off
            </p>
            <h2 className="mt-1 font-display text-[1.35rem] font-semibold leading-[1.15] text-ink">
              {title}
            </h2>
          </div>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-ink/60">{subtitle}</p>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-stone/30 px-3 py-2.5">
          <div className="flex min-w-0 items-center">
            {thumbs.length > 0 ? (
              <div className="flex -space-x-2.5">
                {thumbs.map((src, index) => (
                  <img
                    key={`${src}-${index}`}
                    src={src}
                    alt=""
                    aria-hidden="true"
                    className="h-10 w-9 rounded-lg border-2 border-ivory object-cover"
                  />
                ))}
              </div>
            ) : (
              <span className="grid h-10 w-9 place-items-center rounded-lg bg-ink/5 text-ink/50">
                <PackageCheck size={17} />
              </span>
            )}
            <div className="ml-3 min-w-0">
              <p className="truncate text-[11px] text-ink/55">
                {itemCount} {itemCount === 1 ? 'item' : 'items'} · order summary
              </p>
              <p className="font-display text-base font-semibold leading-tight">
                {formatINR(amount)}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-ink/10 bg-ivory px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-ink/55">
            UPI
          </span>
        </div>

        <ol className="mt-5" aria-label="Payment progress">
          {steps.map((step, index) => {
            const last = index === steps.length - 1;
            return (
              <li key={step.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={
                      step.state === 'done'
                        ? 'grid h-6 w-6 place-items-center rounded-full bg-ink text-ivory'
                        : step.state === 'active'
                          ? 'grid h-6 w-6 place-items-center rounded-full bg-lime text-ink ring-4 ring-lime/25'
                          : 'grid h-6 w-6 place-items-center rounded-full border border-ink/15 bg-ivory text-ink/35'
                    }
                  >
                    {step.state === 'done' ? (
                      <Check size={13} strokeWidth={2.8} />
                    ) : step.state === 'active' ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  {!last && (
                    <span
                      className={`my-1 w-px flex-1 ${step.state === 'done' ? 'bg-ink/25' : 'bg-ink/10'}`}
                    />
                  )}
                </div>
                <p
                  className={`pb-3 text-[12.5px] leading-tight ${
                    step.state === 'pending'
                      ? 'text-ink/40'
                      : step.state === 'active'
                        ? 'font-semibold text-ink'
                        : 'text-ink/65'
                  }`}
                >
                  {step.label}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
          <div className="h-full w-1/3 rounded-full bg-ink animate-[handoff-progress_1.1s_ease-in-out_infinite]" />
        </div>
        {progressLabel && (
          <p className="mt-2 text-center text-[10px] uppercase tracking-[0.18em] text-ink/40">
            {progressLabel}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink/10 pt-3.5 text-[10px] font-medium text-ink/50">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} /> Razorpay secured
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Smartphone size={13} /> UPI · Cards
          </span>
        </div>
        <p className="mt-2.5 text-center text-[11px] leading-relaxed text-ink/45">{note}</p>
      </div>
    </div>
  );
}
