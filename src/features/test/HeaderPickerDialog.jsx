import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, Link2, X } from 'lucide-react'
import { HEADER_GALLERY } from './headerGallery.js'

const SOURCES = [
  ['gallery', 'Gallery', LayoutGrid],
  ['url', 'By web address', Link2],
]

// "Select header" (a copy of PeraForm's): the Quality Tools gallery, by
// category, or an image at a web address. PeraForm's Upload and Google
// Drive need file storage, which HyperCBT doesn't have yet.
// Calls onPicked({ url }).
export default function HeaderPickerDialog({ open, onClose, onPicked }) {
  const ref = useRef(null)
  const [source, setSource] = useState('gallery')
  const [category, setCategory] = useState(HEADER_GALLERY[0].key)
  const [url, setUrl] = useState('')
  const [checked, setChecked] = useState({ url: '', ok: null }) // the last address that finished loading

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // A typed address is checked by loading it (so a broken link is caught);
  // until it has, it's neither good nor bad.
  const typed = url.trim()
  const urlOk = checked.url === typed ? checked.ok : null
  useEffect(() => {
    if (!/^https:\/\/\S+$/i.test(typed)) return
    const img = new Image()
    img.onload = () => setChecked({ url: typed, ok: true })
    img.onerror = () => setChecked({ url: typed, ok: false })
    img.src = typed
  }, [typed])

  function choose(image) {
    onPicked(image)
    onClose()
  }

  const gallery = HEADER_GALLERY.find((c) => c.key === category)

  return (
    <dialog
      ref={ref}
      className="header-picker"
      aria-label="Select header"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="header-picker-body">
        <div className="header-picker-head">
          <h2>Select header</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="header-picker-main">
          <nav className="header-picker-nav" aria-label="Where from">
            {SOURCES.map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                className={source === key ? 'active' : ''}
                aria-current={source === key ? 'page' : undefined}
                onClick={() => setSource(key)}
              >
                <Icon size={18} aria-hidden="true" /> {label}
              </button>
            ))}
          </nav>

          <section className="header-picker-pane">
            {source === 'gallery' && (
              <>
                <div className="header-picker-tabs" role="tablist" aria-label="Categories">
                  {HEADER_GALLERY.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      role="tab"
                      aria-selected={category === c.key}
                      className={category === c.key ? 'active' : ''}
                      onClick={() => setCategory(c.key)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="header-picker-grid">
                  {gallery.images.map((img) => (
                    <button key={img.url} type="button" className="header-picker-img" onClick={() => choose({ url: img.url })}>
                      <img src={img.url} alt={img.label} loading="lazy" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {source === 'url' && (
              <div className="header-picker-url">
                <label className="field">
                  Image address (https)
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/banner.jpg" />
                </label>
                {urlOk === true && <img className="header-picker-preview" src={url.trim()} alt="" />}
                {urlOk === false && <p className="form-error">That address didn’t load as an image.</p>}
                <p className="key-note">
                  The image stays where it is online; if that site removes it, your header goes blank.
                </p>
                <button type="button" className="btn btn-primary" disabled={urlOk !== true} onClick={() => choose({ url: url.trim() })}>
                  Use this image
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </dialog>
  )
}
