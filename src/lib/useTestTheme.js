import { useEffect } from 'react'
import { loadThemeFont, themeOf, themeStyle } from './theme.js'
import { useTheme } from './useTheme.js'

// Puts a test's theme (Theme panel → test.theme) on the whole page while
// it's shown: the colours (and, on the candidate's pages, the font) go on
// <html>, so the background, the top bar and open windows all follow it.
// Tests without a theme keep HyperCBT's own look. font: false for the
// editor, which keeps the app's own type.
export function useTestTheme(test, { font = true } = {}) {
  const { theme: mode } = useTheme()
  const theme = test?.theme ? themeOf(test) : null
  const key = theme ? JSON.stringify([theme.color, theme.background, theme.font, mode, font]) : ''

  useEffect(() => {
    if (!key) return
    const [color, background, fontKey, m, withFont] = JSON.parse(key)
    if (withFont) loadThemeFont(fontKey)
    const style = themeStyle({ color, background, font: fontKey }, m === 'dark', { font: withFont })
    const root = document.documentElement
    Object.entries(style).forEach(([name, value]) => root.style.setProperty(name, value))
    return () => Object.keys(style).forEach((name) => root.style.removeProperty(name))
  }, [key])
}
