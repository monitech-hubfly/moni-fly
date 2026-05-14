'use client';

/**
 * Portal estático completo (Playfair/DM Sans) — public/onboarding/onboarding_moni_1.html
 * ?embedded=true esconde a sidebar; #step1 abre a secção sec-step1.
 */
export function OnboardingPortalMoniHtml() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#faf8f3]">
      <iframe
        title="Onboarding Moní — portal HTML completo"
        src="/onboarding/onboarding_moni_1.html?embedded=true"
        className="min-h-[70vh] w-full flex-1 border-0"
      />
    </div>
  );
}
