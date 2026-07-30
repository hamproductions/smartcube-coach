import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'twisty-player': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        alg?: string
        puzzle?: string
        visualization?: string
        background?: string
        'control-panel'?: string
        'experimental-setup-alg'?: string
        'hint-facelets'?: string
      }
    }
  }
}
