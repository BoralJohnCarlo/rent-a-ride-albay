import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/public/RegisterOperator.jsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const noop = () => {};
function handler(name, next, context) {
    const start = source.indexOf(`    const ${name} =`);
    const body = source.slice(start, source.indexOf(`    const ${next} =`, start));
    return new Function(...Object.keys(context), `${body}; return ${name};`)(...Object.values(context));
}
function fixture(overrides = {}) {
    const removed = [];
    let step;
    let payload;
    const context = {
        submissionInFlightRef: { current: false }, verificationRequestRef: { current: false },
        registrationFlowRef: { current: false }, validateStep: () => true,
        termsReady: true, termsAgreed: true, loading: false, termsDocument: { _id: 'accepted-version' },
        idImages: [{ file: 'front' }, { file: 'back' }], vehicleImages: [{ file: 'vehicle' }],
        formData: {
            ...Object.fromEntries(['firstName', 'lastName', 'email', 'phoneNumber', 'alternativeContact', 'middleName', 'brand', 'model', 'plateNumber', 'registrationNumber'].map(key => [key, 'test'])),
            specifications: {}, password: 'Password123', currentAddress: {},
        },
        isCustom: false, proofOfBillingEnabled: false,
        uploadValidId: async file => ({ data: { uploadId: file, url: `https://example.com/${file}` } }),
        uploadRegistrationVehicleImage: async () => ({ data: { uploadId: 'vehicle', url: 'https://example.com/vehicle' } }),
        removeTemporaryValidId: async id => { removed.push(id); },
        registerOperator: async value => { payload = value; },
        setIdUploading: noop, setVehicleImageUploading: noop, setValidationErrors: noop,
        setCurrentStep: value => { step = value; }, startResendCooldown: noop, clearError: noop,
        setVerificationNotice: noop, isPendingVerificationError: message => message.includes('waiting for verification'),
        isTermsOutdatedError: () => false, getRegistrationErrorField: () => null,
        ...overrides,
    };
    return { context, removed, submit: handler('handleSubmit', 'getFieldError', context), get step() { return step; }, get payload() { return payload; } };
}

test('partner submission locks immediately across uploads and releases after success', async () => {
    let release;
    let uploads = 0;
    const firstUpload = new Promise(resolve => { release = resolve; });
    const state = fixture({ uploadValidId: async file => {
        uploads++;
        if (file === 'front') await firstUpload;
        return { data: { uploadId: file, url: `https://example.com/${file}` } };
    } });
    const first = state.submit();
    await state.submit();
    assert.equal(uploads, 1);
    release();
    await first;
    assert.equal(state.step, 5);
    assert.equal(state.context.submissionInFlightRef.current, false);
    assert.equal(state.payload.termsVersionId, 'accepted-version');
    assert.equal(state.payload.termsAgreed, true);
    assert.deepEqual(state.removed, []);
});

test('lost registration response preserves all submitted images and releases the lock', async () => {
    const state = fixture({ registerOperator: async () => { throw new Error('Network Error'); } });
    await state.submit();
    assert.deepEqual(state.removed, []);
    assert.equal(state.context.submissionInFlightRef.current, false);
});

test('partial upload failure removes unused uploads and permits retry', async () => {
    const state = fixture({ uploadValidId: async file => {
        if (file === 'back') throw new Error('Upload failed');
        return { data: { uploadId: file, url: `https://example.com/${file}` } };
    } });
    await state.submit();
    assert.deepEqual(state.removed, ['front']);
    assert.equal(state.context.submissionInFlightRef.current, false);
    assert.equal(state.step, undefined);
});

test('existing pending registration opens verification without deleting submitted images', async () => {
    let notice;
    const state = fixture({ registerOperator: async () => { throw new Error('waiting for verification'); }, setVerificationNotice: value => { notice = value; } });
    await state.submit();
    assert.equal(state.step, 5);
    assert.match(notice, /original details/);
    assert.deepEqual(state.removed, []);
});

test('unavailable terms block uploads and submission', async () => {
    let uploads = 0;
    const state = fixture({ termsReady: false, uploadValidId: async () => { uploads++; } });
    await state.submit();
    assert.equal(uploads, 0);
    assert.equal(state.payload, undefined);
});

test('vehicle step rejects invalid numeric fields before advancing and accepts boundary values', () => {
    const nextYear = new Date().getFullYear() + 1;
    for (const [year, seats, field] of [
        ['2025.5', '4', 'year'], ['1899', '4', 'year'],
        [String(nextYear + 1), '4', 'year'], ['', '4', 'year'],
        ['2025', '2.5', 'seatingCapacity'], ['2025', '51', 'seatingCapacity'],
        ['2025', '0', 'seatingCapacity'], ['2025', '', 'seatingCapacity'],
        ['2025', 'NaN', 'seatingCapacity'], ['2025', 'Infinity', 'seatingCapacity'],
        ['1900', '1', null], [String(nextYear), '50', null],
    ]) {
        let errors;
        let advanced = false;
        const validate = handler('validateStep', 'handleNext', {
            currentStep: 2, isCustom: false, isPastDate: () => false,
            formData: { vehicleType: 'Car', brand: 'Toyota', model: 'Vios', year,
                plateNumber: 'ABC1234', registrationNumber: '1234', registrationExpiration: '',
                specifications: { transmission: 'Automatic', fuelType: 'Gasoline', seatingCapacity: seats } },
            vehicleImages: [{ file: { type: 'image/jpeg', size: 100 } }],
            setValidationErrors: value => { errors = value; }, setHasValidated: noop,
        });
        handler('handleNext', 'handlePrevious', { validateStep: validate, setCurrentStep: () => { advanced = true; } })();
        assert.equal(advanced, field === null, `year=${year}, seats=${seats}`);
        if (field === 'year') assert.ok(errors.year);
        if (field === 'seatingCapacity') assert.match(errors.specifications.seatingCapacity, /whole number from 1 to 50/);
    }
});

test('verification and resend cannot overlap in either direction', async () => {
    for (const first of ['verify', 'resend']) {
        let release;
        let requests = 0;
        let step;
        let cleared;
        const wait = new Promise(resolve => { release = resolve; });
        const request = async () => { requests++; await wait; };
        const context = {
            verificationRequestRef: { current: false }, code: ['1','2','3','4','5','6'],
            formData: { email: 'partner@example.com', password: 'Password123' },
            setVerificationError: noop, setResendError: noop, setIsVerifying: noop, setIsResending: noop,
            verifyUserEmail: request, resendVerificationEmailApi: request, loginUser: async () => {},
            setCurrentStep: value => { step = value; }, clearError: noop, isAlreadyVerifiedError: () => false,
            resendDisabled: false, startResendCooldown: noop, setCode: value => { cleared = value; },
            codeInputRefs: { current: [] }, setResendDisabled: noop, setResendCooldown: noop,
            resendTimerRef: { current: null },
        };
        const verify = handler('verifyCode', 'startResendCooldown', context);
        const resend = handler('resendCode', 'handleSubmit', context);
        const pending = first === 'verify' ? verify() : resend();
        await (first === 'verify' ? resend() : verify());
        assert.equal(requests, 1);
        release();
        await pending;
        assert.equal(context.verificationRequestRef.current, false);
        if (first === 'verify') assert.equal(step, 6);
        else assert.deepEqual(cleared, ['', '', '', '', '', '']);
    }
});

test('Back cannot edit a submitted registration or interrupt an active request', () => {
    for (const [currentStep, submitting, verifying, expected] of [[4,false,false,3],[5,false,false,undefined],[6,false,false,undefined],[4,true,false,undefined],[4,false,true,undefined]]) {
        let step;
        handler('handlePrevious', 'verifyCode', {
            currentStep, submissionInFlightRef: { current: submitting }, verificationRequestRef: { current: verifying },
            setCurrentStep: update => { step = update(currentStep); },
        })();
        assert.equal(step, expected);
    }
});
