import { Check, Lock } from "lucide-react";
import Input from "../common/Input";
import { getRegistrationPasswordFeedback } from "../../utils/registrationPasswordFeedback";

export default function RegistrationPasswordFields({ password, confirmPassword, onChange, confirmationError = "" }) {
    const feedback = getRegistrationPasswordFeedback(password, confirmPassword, Boolean(confirmationError));
    return (
        <div className="min-w-0 space-y-4">
            <div className="min-w-0 space-y-2">
                <Input id="password" name="password" type="password" label="Password"
                    placeholder="Create a password" value={password} onChange={onChange}
                    autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    leftIcon={<Lock size={17} />} className="min-w-0 text-base"
                    style={{ fontSize: 16, minHeight: 48 }}
                    error={feedback.passwordError ? <span className="text-sm">Your password still needs:</span> : ""}
                    aria-invalid={Boolean(feedback.passwordError)}
                    aria-describedby={feedback.passwordError ? "password-requirements" : undefined} required />
                {feedback.passwordError && (
                    <ul id="password-requirements" aria-label="Unmet password requirements" aria-live="polite"
                        className="min-w-0 space-y-1 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
                        {feedback.unmet.map((rule) => <li key={rule.id} className="flex min-w-0 items-start gap-2">
                            <span aria-hidden="true" className="shrink-0">•</span>
                            <span className="min-w-0 break-words">{rule.label}</span>
                        </li>)}
                    </ul>
                )}
            </div>
            <div className="min-w-0 space-y-2">
                <Input id="confirmPassword" name="confirmPassword" type="password" label="Confirm Password"
                    placeholder="Repeat your password" value={confirmPassword} onChange={onChange}
                    autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    leftIcon={<Lock size={17} />} className="min-w-0 text-base"
                    style={{ fontSize: 16, minHeight: 48 }}
                    error={feedback.confirmationError ? <span className="text-sm" role="status">{feedback.confirmationError}</span> : ""}
                    aria-invalid={Boolean(feedback.confirmationError)}
                    aria-describedby={feedback.matches ? "password-match" : undefined} required />
                <div aria-live="polite" className="min-w-0">
                    {feedback.matches && <p id="password-match" className="flex items-start gap-1.5 text-sm text-green-700 dark:text-green-400">
                        <Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" />Passwords match.
                    </p>}
                </div>
            </div>
        </div>
    );
}
