import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const operator = readFileSync(new URL('../src/pages/public/RegisterOperator.jsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const zone = readFileSync(new URL('../src/components/shared/ImageUploadZone.jsx', import.meta.url), 'utf8').replaceAll('\r\n', '\n');

test('partner Replace ID images tolerates empty slots and releases remaining previews', () => {
    const start = operator.indexOf('                                                                idImages.forEach');
    const body = operator.slice(start, operator.indexOf('                                                            }}', start));
    for (const images of [[{ preview: 'blob:front' }, null], [undefined, { preview: 'blob:back' }], [null, null]]) {
        const revoked = [];
        let selected;
        let form = { validIdImage: 'front', validIdBack: 'back' };
        new Function('idImages', 'URL', 'removeTemporaryValidId', 'setIdImages', 'setFormData', body)(
            images, { revokeObjectURL: url => revoked.push(url) }, async () => {},
            value => { selected = value; }, update => { form = update(form); },
        );
        assert.deepEqual(selected, []);
        assert.deepEqual(form, { validIdImage: '', validIdBack: '' });
        assert.deepEqual(revoked, images.filter(Boolean).map(image => image.preview));
    }
});

test('vehicle previews survive adding files, primary changes and retained step unmounts', () => {
    const normalizeStart = zone.indexOf('const normalizeImage =');
    const normalize = new Function(`${zone.slice(normalizeStart, zone.indexOf('const ImageUploadZone ='))}; return normalizeImage;`)();
    const bodyStart = zone.indexOf('    const inputRef =', zone.indexOf('const ImageUploadZone ='));
    const body = zone.slice(bodyStart, zone.indexOf('\n    return (', bodyStart));
    const revoked = [];
    const hooks = [];
    let cursor;
    let images = [{ id: 'one', preview: 'blob:one' }];
    const render = (revokePreviewsOnUnmount) => {
        cursor = 0;
        const context = {
            images, revokePreviewsOnUnmount, normalizeImage: normalize,
            disabled: false, canUpload: true, canDelete: true, canSetPrimary: true, maxFiles: 5,
            onChange: value => { images = value; },
            URL: { revokeObjectURL: url => revoked.push(url) },
            useState: () => ['', () => {}], useMemo: fn => fn(),
            useRef: initial => { const slot = cursor++; return hooks[slot] ??= { current: initial }; },
            useEffect: (fn, deps) => {
                const slot = cursor++;
                const previous = hooks[slot];
                if (!previous || deps.some((dep, index) => dep !== previous.deps[index])) {
                    previous?.cleanup?.();
                    hooks[slot] = { deps, cleanup: fn() };
                }
            },
        };
        return new Function(...Object.keys(context), `${body}; return {handlePrimaryImage, handleRemoveImage};`)(...Object.values(context));
    };
    render(false);
    images = [...images, { id: 'two', preview: 'blob:two' }];
    render(false).handlePrimaryImage('two');
    render(false);
    hooks.forEach(hook => hook.cleanup?.()); // Leave the vehicle step.
    assert.deepEqual(revoked, []);
    hooks.length = 0;
    render(false).handleRemoveImage('one'); // Return and explicitly remove an image.
    assert.deepEqual(revoked, ['blob:one']);
    assert.deepEqual(images.map(image => image.id), ['two']);
    assert.match(operator, /revokePreviewsOnUnmount=\{false\}/);
});

test('registration owner releases retained previews only when the whole form unmounts', () => {
    const start = operator.indexOf('    useEffect(() => () => {\n        retainedImagesRef.current');
    const end = operator.indexOf('    }, []);', start) + '    }, []);'.length;
    const images = [{ preview: 'blob:id' }, null, { preview: 'blob:billing' }, { preview: 'blob:vehicle' }, { url: 'https://example.com/saved' }];
    const revoked = [];
    let cleanup;
    new Function('useEffect', 'retainedImagesRef', 'URL', operator.slice(start, end))(
        effect => { cleanup = effect(); }, { current: images }, { revokeObjectURL: url => revoked.push(url) },
    );
    assert.deepEqual(revoked, []);
    cleanup();
    assert.deepEqual(revoked, ['blob:id', 'blob:billing', 'blob:vehicle']);
});
