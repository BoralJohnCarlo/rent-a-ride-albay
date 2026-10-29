import { LEGAL_DOCUMENT_TYPES } from "../constants/legalDocumentConstants.js";

/*
 * Version 1 of each legal document, published automatically the first time
 * it's read: the wording the app shipped with before the documents became
 * editable. Admins change them from Settings → Terms & Policies.
 */

const text = (value) => ({ kind: "text", text: value, liveKey: "" });
const live = (liveKey) => ({ kind: "live", text: "", liveKey });

const section = (key, title, icon, items, condition = "") => ({
    key,
    title,
    icon,
    condition,
    items,
});

const BOOKING_TERMS = {
    title: "Terms & Conditions",
    intro: "Please read these terms carefully before booking a vehicle. They apply to rentals processed through the Rent-A-Ride Albay Car Rental Management System.",
    highlights: [
        { label: "Vehicle types", value: "Cars & motorcycles" },
        { label: "Payment", value: "GCash / QRPh" },
        { label: "Location", value: "Albay, Philippines" },
    ],
    notice: {
        title: "Important",
        body: "Vehicle-specific prices, deposits, mileage allowances, applicable fees, and booking conditions shown in the booking summary take precedence for that particular rental where they differ from a general policy stated here.",
    },
    acceptanceLabel:
        "I have read and understood the Rent-A-Ride Albay Terms & Conditions, including the fuel-return, payment, cancellation, vehicle-condition, late-return, and prohibited-use requirements. I agree to be bound by the applicable terms for my booking.",
    sections: [
        section("rental-period", "Pickup Time and Rental Period", "clock", [
            live("pickupTimeRules"),
            live("turnaroundBuffer"),
            live("rentalPeriodRules"),
        ]),
        section("cancellation", "Cancellation and Refunds", "wallet", [
            live("cancellationPolicy"),
            live("noShowTiming"),
            live("cancellationProcess"),
            text("A cancellation or refund is final once its status is recorded by the system or an administrator. A refund's status may be tracked separately from the booking's."),
        ]),
        section("vehicle-maintenance", "Vehicle Maintenance Before Your Rental", "file-check", [
            text("If the vehicle you booked has to go under maintenance over your rental dates before you pick it up, you'll be notified and offered a choice: switch to another available vehicle for the same dates and times, or cancel for a full refund with no cancellation fee."),
            text("If the replacement vehicle costs more for your dates, the difference is paid online before pickup; if it costs less, what you paid above the new price is refunded (or the lower price is taken off what's due at pickup). Any voucher you used still applies, or is returned if you cancel."),
            text("You'll have a deadline to choose — normally 48 hours, and no later than 24 hours before pickup. If no option is chosen by then, the booking is cancelled and refunded in full automatically. If the vehicle turns out to be ready in time, your booking simply goes ahead as made."),
        ]),
        section("booking-changes", "Rescheduling", "file-check", [
            live("rescheduling"),
            text("A reschedule isn't effective until it is approved and the booking shows the new schedule."),
        ]),
        section("payment", "Payment Terms", "wallet", [
            live("payment"),
            text("The customer is responsible for checking the amount and payment status before treating the booking as paid."),
            text("Rental charges, driver fees, distance fees and other amounts are those shown in the booking or rental summary."),
        ]),
        section("late-return", "Late Return and Extensions", "alert", [
            live("lateReturn"),
            live("extensions"),
            live("lateReturnEffects"),
            text("An extension request doesn't guarantee continued use of the vehicle. It may have to be returned on time if another booking, maintenance, an owner instruction or a safety concern prevents the extension."),
            text("Failure to settle required extension charges may result in retrieval of the rented vehicle, consistent with the rental agreement."),
        ]),
        section(
            "early-return",
            "Early Return Credit",
            "gift",
            [
                live("earlyReturnCredit"),
                text("Only full unused days count; a partial day is not credited."),
                text("The voucher is issued to the customer's own account and cannot be transferred or exchanged for cash."),
            ],
            "earlyReturnEnabled"
        ),
        section("security-deposit", "Security Deposit", "shield", [
            text("Some vehicles require a security deposit, collected at pickup. The amount is shown on the vehicle listing and booking summary."),
            live("depositRules"),
            text("Eligible deductions may include vehicle damage, missing items, excessive cleaning, late-return charges, unpaid extension charges, fuel shortages, or other documented rental obligations."),
        ]),
        section("vehicle-condition", "Vehicle Condition and Inspection", "car", [
            text("The customer must inspect the vehicle at pickup and review its recorded condition before accepting the rental."),
            text("Existing dents, scratches, mechanical issues, missing accessories, and other visible conditions should be documented in the inspection record before departure."),
            text("The customer must immediately report any new damage, accident, warning indicator, mechanical problem, or safety concern to Rent-A-Ride Albay."),
            text("The vehicle must be returned in substantially the same condition in which it was released, excluding reasonable wear from normal use."),
            text("Failure to report damage promptly may affect the customer's responsibility for related costs, subject to the facts of the incident and applicable law."),
        ]),
        section("fuel", "Fuel Usage", "fuel", [
            live("fuelRules"),
            text("The pickup and return fuel levels are recorded as part of the vehicle inspection."),
        ]),
        section("insurance-liability", "Insurance and Liability", "shield", [
            text("Any insurance or protection included with a specific rental is limited to the coverage expressly stated in the booking or rental agreement."),
            text("Where offered, collision damage waiver or similar protection is subject to its stated terms, exclusions, deductibles, and eligibility requirements."),
            text("Coverage does not automatically apply to prohibited, unauthorized, reckless, or unlawful use of the vehicle."),
            text("Examples of excluded conduct may include driving while intoxicated, unauthorized driving, off-road use, racing, intentional damage, or use of the vehicle for unlawful activities."),
            text("Personal accident coverage, if offered, is subject to the separate terms of the applicable coverage provider."),
            text("The customer remains responsible for complying with traffic laws and for reporting accidents or incidents immediately."),
        ]),
        section("driver", "Driver Requirements", "id-card", [
            live("licenseRules"),
            live("authorizedDriverRule"),
            text("Rent-A-Ride Albay may refuse release of a vehicle when required identification, licensing, or verification cannot be completed."),
        ]),
        section("age", "Age Restrictions", "id-card", [
            text("The minimum age requirement for a rental is 21 years old unless a different requirement is displayed for a specific vehicle or rental category."),
            text("Certain vehicle categories may have stricter age or driving-experience requirements."),
            text("Drivers below 25 years old may be subject to an additional young-driver fee when applicable."),
            text("The customer must provide truthful age and identity information during registration and booking."),
        ]),
        section("mileage", "Mileage Limits", "car", [
            text("Any mileage allowance and excess-mileage rate shown in the booking summary or vehicle listing form part of the rental agreement."),
            text("Customers are responsible for charges resulting from mileage exceeding the applicable allowance."),
            text("If a vehicle is advertised with unlimited mileage, the unlimited-mileage condition applies only to the geographic and usage restrictions stated in the booking."),
        ]),
        section("prohibited", "Prohibited Uses", "alert", [
            text("Commercial, delivery, ride-hailing, racing, or other commercial use is prohibited unless expressly authorized."),
            text("Off-road driving is prohibited unless the vehicle and rental agreement expressly permit it."),
            text("Towing or using the vehicle to push another vehicle is prohibited unless specifically authorized."),
            text("Smoking or vaping inside the vehicle is prohibited."),
            live("authorizedDriverRule"),
            text("Transporting illegal goods, hazardous unauthorized materials, or using the vehicle for unlawful activities is prohibited."),
            text("Reckless driving, racing, excessive speeding, or intentional misuse of the vehicle is prohibited."),
            text("Customers must comply with all applicable traffic, parking, and road-safety laws."),
        ]),
        section("force-majeure", "Force Majeure", "alert", [
            text("Rent-A-Ride Albay may be unable to fulfill or continue a booking because of circumstances beyond reasonable control."),
            text("Examples include natural disasters, severe weather, road closures, government restrictions, public emergencies, pandemics, health emergencies, or other events that make rental unsafe or unlawful."),
            text("When such circumstances occur, the parties will work in good faith to determine whether the booking should be rescheduled, cancelled, or otherwise adjusted."),
            text("Any refund or credit resulting from a force-majeure event is subject to the circumstances, payment-provider rules, and the applicable rental agreement."),
        ]),
        section("gps", "GPS Tracking and Vehicle Monitoring", "car", [
            text("Some rented vehicles may be equipped with GPS tracking or other monitoring technology for security, vehicle recovery, rental-duration monitoring, and operational purposes."),
            text("The system may receive, validate, record, and display vehicle location data to authorized administrators."),
            text("For a partner (consigned) vehicle, the vehicle owner may also see the vehicle's live location and up to the last 7 days of its route history, including during a rental. The owner is never shown the renter's name, contact details, or booking details through this feature."),
            text("GPS availability and accuracy may depend on the installed device, network connectivity, and third-party services."),
            text("Customers must not disable, tamper with, remove, or interfere with an installed tracking device."),
        ]),
        section("motorcycles", "Motorcycle-Specific Geographic Restrictions", "car", [
            live("motorcycleAreaRule"),
            text("Travel beyond Baguio and travel outside Luzon are prohibited unless the business expressly authorizes an exception."),
            text("Customers must confirm geographic restrictions applicable to the specific vehicle before beginning the rental."),
        ]),
        section("consignment", "Consigned and Partner Vehicles", "car", [
            text("Some vehicles available through Rent-A-Ride Albay may be provided under a consignment arrangement with an external vehicle owner."),
            text("A consigned vehicle is subject to availability verification before the administrator approves a booking."),
            text("The administrator may coordinate with the vehicle owner before confirming availability, which can affect booking approval time."),
            text("Partner vehicles remain subject to the same customer booking, inspection, payment, fuel, return, and prohibited-use requirements unless a vehicle-specific agreement states otherwise."),
            text("The vehicle owner may have separate commercial or consignment arrangements with Rent-A-Ride Albay. Those arrangements do not remove the customer's obligations under the rental agreement."),
            text("Any owner commission, payout, or internal consignment accounting is a business-to-owner matter and does not change the customer's confirmed rental price unless expressly shown in the booking."),
        ]),
        section("ids-verification", "Valid ID and Account Verification", "id-card", [
            text("Customers must provide accurate personal information during account registration and booking."),
            text("A valid government-issued ID and other verification information may be required before a booking or vehicle release can be completed."),
            text("Rent-A-Ride Albay may verify submitted information for identity, eligibility, booking security, and fraud-prevention purposes."),
            text("Providing false, altered, expired, or misleading identification information may result in booking rejection or cancellation."),
        ]),
        section("privacy", "Privacy Notice", "shield", [
            text("When you register, Rent-A-Ride Albay collects your name, birthdate, contact details, address, government ID images, and (if provided) driver's license details. Partners also provide details and photos of their vehicle."),
            text("This information is used to verify your identity and eligibility, process and secure bookings and payments, contact you about your account and rentals, and prevent fraud."),
            text("ID images are stored with a third-party image hosting provider (Cloudinary) at unlisted links. Within the app they are shown only to Rent-A-Ride Albay administrators and to the account holder; anyone who obtained an image's exact link could open it, so never share those links. Partners are never shown a renter's name, contact details, or ID."),
            text("If you start a registration but never verify your email, the images you uploaded are deleted automatically shortly after the verification code expires."),
            text("Under the Data Privacy Act of 2012 (Republic Act No. 10173), you may ask to access, correct, or delete your personal information, or withdraw your consent, through the official support/contact channel shown on the website. Withdrawing consent may mean we can no longer provide rentals to you."),
        ]),
        section("dispute", "Dispute Resolution", "gavel", [
            text("Customers should first contact Rent-A-Ride Albay through the official support/contact channel shown on the website to resolve complaints or booking disputes."),
            text("The parties should attempt good-faith discussion and, where appropriate, mediation before pursuing formal legal proceedings."),
            text("Any arbitration or formal dispute-resolution process will apply only where validly agreed by the parties or required by applicable law."),
            text("The governing jurisdiction should be the appropriate jurisdiction applicable to Rent-A-Ride Albay's business operations in Albay, Philippines, subject to applicable Philippine law."),
        ]),
        section("acceptance", "Acceptance of Terms", "check", [
            text("By checking the acceptance box when registering or submitting a booking, the customer confirms that they have read and understood these Terms and Conditions, including the Privacy Notice."),
            text("Electronic acceptance, including a checkbox, button, or equivalent confirmation, constitutes the customer's consent to the terms applicable to the booking, to the extent permitted by law."),
            text("The customer acknowledges that the booking, payment, vehicle inspection, rental period, fuel condition, and return obligations form part of the rental transaction."),
            text("The customer should retain the booking confirmation and payment receipt for their records."),
            text("If the customer does not agree with these Terms and Conditions, they should not proceed with the booking."),
        ]),
    ],
};

const PARTNER_TERMS = {
    title: "Partner/Consignment Terms",
    intro: "",
    highlights: [],
    notice: {
        title: "",
        body: "These Partner/Consignment Terms apply specifically to the vehicle you're submitting. Please read each section before agreeing.",
    },
    acceptanceLabel:
        "I have read and agree to the Partner/Consignment Terms above, including the inspection, commission and payout, vehicle availability, and listing removal requirements.",
    sections: [
        section("ownership", "Vehicle Ownership & Document Authenticity", "file-check", [
            text("The partner confirms they are the legal owner of the vehicle, or are authorized by the owner to submit it for consignment on the owner's behalf."),
            text("The plate number, registration number, Official Receipt (OR), Certificate of Registration (CR), and vehicle photos submitted are genuine, current, and unaltered."),
            text("The vehicle is free of any lien, dispute, or restriction that would prevent it from being legally rented out to third parties for the duration it remains listed."),
            text("Submitting false, expired, or altered documents is grounds for immediate rejection of the application or removal of an already-approved listing."),
        ]),
        section("accuracy", "Accuracy of Submitted Information", "car", [
            text("All vehicle details — type, brand, model, specifications, and description — must accurately reflect the vehicle's actual, current condition."),
            text("Photos must clearly and honestly represent the vehicle being offered; misleading or outdated photos are not permitted."),
            text("The partner must promptly notify Rent-A-Ride Albay of any material change to the vehicle's condition, documents, or legal status after submission or approval."),
            text("Misrepresenting a vehicle's condition or documents may result in rejection, suspension, or removal of the listing, and may affect eligibility for future submissions."),
        ]),
        section("inspection", "Physical Inspection Requirement", "calendar", [
            text("Every consignment application requires a physical inspection appointment, booked against the available slots shown on the Appointment step."),
            text("The vehicle must be made available, in the condition described, at the scheduled inspection date and time."),
            text("A missed appointment, a vehicle that doesn't match its submitted description, or a failed inspection may delay approval or require the application to be revised and resubmitted."),
            text("Rescheduling an inspection is subject to slot availability and does not guarantee a specific new date."),
        ]),
        section("review-approval", "Admin Review, Approval & Pricing Discretion", "shield", [
            text("Submitting a consignment application does not guarantee approval. Rent-A-Ride Albay reviews every application and may approve, reject, or request revisions at its discretion."),
            text("Upon approval, Rent-A-Ride Albay sets the vehicle's rental pricing (daily rate and reservation fee) and, where applicable, the commission arrangement for that vehicle — the partner does not set these directly."),
            text("An approved vehicle becomes a live, bookable listing on the platform; the partner will be notified once this happens."),
            text("Rent-A-Ride Albay may request additional information, documents, or revisions at any stage of review before making a final decision."),
        ]),
        section("commission-payout", "Commission & Payout Terms", "wallet", [
            text("A platform commission is deducted from each completed booking involving the vehicle — either the platform's default rate, or an individually-negotiated rate for that specific vehicle, agreed at approval time."),
            text("The partner's remaining earnings from a completed booking are credited to their in-app wallet after the applicable payout hold period, which allows time for a late refund or dispute to be resolved first."),
            text("Wallet balances may be withdrawn to the partner's registered GCash account, subject to the platform's minimum withdrawal amount and processing terms."),
            text("Where an individually-negotiated commission rate was set for a vehicle at approval time, that rate stays with the vehicle going forward even if the platform's default rate changes later."),
        ]),
        section("availability", "Vehicle Availability & Withdrawal Requests", "calendar", [
            text("The partner may request that a vehicle be withdrawn from booking on specific or consecutive dates (for example, for maintenance, servicing, or personal use)."),
            text("Such a request must state a reason and is subject to admin approval before it takes effect — the vehicle remains bookable until the request is approved."),
            text("A withdrawal request cannot be made, or approved, for dates on which the vehicle already has a confirmed booking."),
            text("Once approved, the vehicle will not be bookable for the approved date range until that period passes or the block is otherwise lifted by an admin."),
        ]),
        section("bookings", "Booking & Customer Management", "users", [
            text("Rent-A-Ride Albay manages the entire customer-facing rental process for the vehicle — booking, payment collection, customer verification, and dispute handling."),
            text("The partner does not have a right to directly contact a customer to negotiate, alter, or cancel a booking outside of the platform's processes."),
            text("The partner may not remove or make the vehicle unavailable to work around, delay, or avoid an existing confirmed booking."),
            text("Any concern about a specific booking should be raised with Rent-A-Ride Albay through the platform's support channel."),
            text("Where a GPS tracker is installed, the partner may view the vehicle's live location and up to the last 7 days of its route history on the Live Tracking page. This information is provided for vehicle security only. The partner must not use it to locate, follow, or contact a renter, or share it with third parties. Any concern should be reported to Rent-A-Ride Albay."),
        ]),
        section("damage-liability", "Damage, Liability & Insurance", "shield", [
            text("Damage caused by a renter during a rental period is assessed and charged according to Rent-A-Ride Albay's penalty and damage policy, applied to the renter — not billed separately to the partner."),
            text("The partner is responsible for maintaining any insurance and roadworthiness requirements required by law for a vehicle offered for hire, and for keeping such coverage current for as long as the vehicle is listed."),
            text("Rent-A-Ride Albay is not responsible for pre-existing mechanical issues, defects, or damage that were not disclosed at submission or inspection."),
        ]),
        section("suspension-removal", "Suspension, Removal & Voluntary Withdrawal", "alert", [
            text("A vehicle listing may be suspended or removed for safety concerns, repeated booking cancellations attributable to the vehicle, expired or invalid documents, or violation of these terms."),
            text("Where a safety or legal concern is urgent, Rent-A-Ride Albay may suspend a listing immediately and notify the partner afterward."),
            text("A partner may withdraw a vehicle from the platform entirely by contacting Rent-A-Ride Albay; any active or confirmed bookings at that time must still be honored."),
        ]),
        section("communication", "Notifications & Communication", "megaphone", [
            text("The partner consents to receive in-app, email, or SMS notifications regarding booking activity, payouts, inspection appointments, and consignment/application status updates."),
            text("Vehicle and account information submitted is used only to operate, verify, and present the listing on the platform."),
        ]),
        section("acceptance", "Acceptance of Partner Terms", "gavel", [
            text("By checking the box below and submitting this application, the partner confirms they have read, understood, and agree to be bound by these Partner/Consignment Terms."),
            text("The partner agrees to indemnify Rent-A-Ride Albay against claims, losses, or costs arising from inaccurate information, undisclosed vehicle defects, or a breach of these terms."),
            text("These terms apply for as long as the vehicle remains listed on the platform, and are in addition to — not a replacement for — the general Rent-A-Ride Albay Terms & Conditions and the account Terms of Service accepted at registration."),
        ]),
    ],
};

const TERMS_OF_SERVICE = {
    title: "Terms for Using Rent-A-Ride Albay",
    intro: "Please review these general terms before using the Rent-A-Ride Albay platform and its rental-related services.",
    highlights: [],
    notice: {
        title: "Please use the platform responsibly",
        body: "By using Rent-A-Ride Albay, users are expected to provide truthful information and use the system responsibly.",
    },
    acceptanceLabel: "",
    sections: [
        section("using-the-platform", "Using the Platform", "", [
            text("Rent-A-Ride Albay provides an online platform for browsing and managing vehicle rental services. Users are expected to provide accurate information and use the platform only for legitimate rental-related purposes."),
        ]),
        section("customer-accounts", "Customer Accounts", "", [
            text("Customers are responsible for the information submitted during registration and for keeping their account credentials secure. Account information should remain accurate and up to date."),
        ]),
        section("vehicle-information", "Vehicle Information", "", [
            text("Vehicle information displayed on the platform may include pricing, specifications, images, availability, and other relevant details. Availability may change depending on the current status of a vehicle."),
        ]),
        section("rental-transactions", "Rental Transactions", "", [
            text("Customers should review the available vehicle information and rental details before proceeding with a transaction. Rental-related actions are subject to the information and conditions presented by the platform."),
        ]),
        section("owners-partners", "Vehicle Owners and Partners", "", [
            text("Vehicle owners and partners who participate in the platform are expected to provide accurate vehicle information and comply with the platform's approval and management procedures."),
        ]),
        section("acceptable-use", "Acceptable Use", "", [
            text("Users should not misuse the platform, provide intentionally misleading information, interfere with system operation, or use the service for unlawful purposes."),
        ]),
        section("availability", "Platform Availability", "", [
            text("The platform may occasionally be unavailable because of maintenance, technical issues, updates, or circumstances outside the platform's control."),
        ]),
        section("changes", "Changes to These Terms", "", [
            text("The terms and information presented on this page may be updated as the Rent-A-Ride Albay system and its services develop. Users should review this page when necessary."),
        ]),
    ],
};

const DEFAULT_LEGAL_DOCUMENTS = Object.freeze({
    [LEGAL_DOCUMENT_TYPES.BOOKING_TERMS]: BOOKING_TERMS,
    [LEGAL_DOCUMENT_TYPES.PARTNER_TERMS]: PARTNER_TERMS,
    [LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE]: TERMS_OF_SERVICE,
});

export default DEFAULT_LEGAL_DOCUMENTS;
