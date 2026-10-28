import { PeraFormMark, QtMark } from './AppMarks.jsx'
import LogoMark from './LogoMark.jsx'

// Every Quality Tools app, for the top bar's app switcher (AppSwitcher.jsx).
// The same list, in the same order, lives in three places - update all of
// them when a tool is added: here, peraform/src/lib/qtApps.js, and the QT
// site's AppsMenu (quality-tools/).
export const QT_APPS = [
  { id: 'qt', name: 'Quality Tools', url: 'https://quality-toolsx.web.app/', Mark: QtMark },
  { id: 'peraform', name: 'PeraForm', url: 'https://peraform-qt.web.app/', Mark: PeraFormMark },
  { id: 'hypercbt', name: 'HyperCBT', url: 'https://hypercbt-qt.web.app/', Mark: LogoMark },
]

// This app's id in QT_APPS (highlighted, and opened in the same tab).
export const CURRENT_APP = 'hypercbt'
