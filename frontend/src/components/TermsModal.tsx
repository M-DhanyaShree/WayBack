interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export default function TermsModal({ isOpen, onClose, title = 'WayBack Freight Terms & Conditions' }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl max-w-2xl w-full border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-5 border-b border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📜</span>
            <div>
              <h3 className="font-bold text-base text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">Standard Indian Road Logistics Carriage Agreement (Carriage by Road Act 2007)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-sm transition"
          >
            &times;
          </button>
        </div>

        {/* Scrollable Terms Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-muted-foreground leading-relaxed">
          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-blue-950 dark:text-blue-200">
            <strong className="block font-semibold mb-1">⚖️ Legal Framework Notice:</strong>
            All freight bookings, backhaul matchings, driver assignments, and transit handovers on the WayBack platform are governed by the <strong>Carriage by Road Act, 2007</strong>, the <strong>Carriage by Road Rules, 2011</strong>, and the <strong>Motor Vehicles Act, 1988</strong>.
          </div>

          <div>
            <h4 className="font-bold text-sm text-foreground mb-1">1. Two-Factor Handover & Digital OTP Verification</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>1st OTP (Pickup / Handover OTP):</strong> Generated upon load confirmation. The shipper/consignor must share this code with the driver only after physical loading and cargo verification at origin. The driver must enter this OTP to authenticate pickup and commence the trip.</li>
              <li><strong>2nd OTP (Consignee Delivery OTP):</strong> Generated for the cargo receiver/consignee. The receiver must share this code with the driver only after examining the unloaded consignment and signing the digital Proof of Delivery (POD).</li>
              <li>Under Section 10 of the Carriage by Road Act 2007, successful submission of the Delivery OTP alongside receiver e-signature and geo-tagged photographic evidence constitutes full legal discharge of carrier liability.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-foreground mb-1">2. Consignor Cargo Declarations & Warranties</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>The customer warrants that the goods do not contain prohibited contraband, explosives, hazardous chemicals, or inflammable substances without statutory permits under the Petroleum Act / Explosives Act.</li>
              <li>Consignments must be appropriately packaged, crated, or palletized to withstand normal road transit vibrations, braking, and weather conditions.</li>
              <li>Weight declared must be accurate within ±5%. Gross vehicle overloading beyond RTO-registered Gross Vehicle Weight (GVW) is strictly forbidden.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-foreground mb-1">3. Loading, Unloading & Detention (Demurrage) Policy</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Free Detention Window:</strong> A standard free window of <strong>2 hours</strong> for loading at origin and <strong>2 hours</strong> for unloading at destination is provided.</li>
              <li><strong>Detention Charges:</strong> If vehicle detention exceeds the free window due to shipper or receiver delays, demurrage will be billed at standard industry rates (₹300/hour or ₹2,500/day for commercial freight vehicles).</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-foreground mb-1">4. Milestone Escrow & Cancellation Policy</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>10% Booking Assurance Deposit:</strong> Required upon load confirmation to lock vehicle allocation and prevent empty-run losses.</li>
              <li><strong>Free Cancellation:</strong> Cancellations made at least 6 hours prior to the scheduled pickup window receive a full refund.</li>
              <li><strong>Late Cancellation:</strong> If cancelled within 6 hours of pickup or after driver arrival at origin, the 10% assurance deposit is forfeited and remitted to the driver as compensation for deadhead fuel and route reservation.</li>
              <li><strong>Balance Settlement:</strong> Final freight balance is released upon OTP and digital POD verification at destination.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-foreground mb-1">5. Transit Insurance & Claims</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Carrier liability is governed by Section 10 & 11 of the Carriage by Road Act 2007. Consignors are strongly advised to obtain comprehensive marine/transit cargo insurance for high-value merchandise.</li>
              <li>Any transit damage, shortage, or seal tampering must be noted on the digital POD before verifying the delivery OTP.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs transition shadow-sm cursor-pointer"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
}
