import { styled } from 'styled-system/jsx'

// Kinetic Logic control: 4px radius, 48px minimum height because it is pressed with a
// cube in both hands. Green fill for the action that starts something, tonal container
// for everything else — the export never uses more than one filled button per surface.
export const Button = styled('button', {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    px: '4',
    minH: 'touch',
    borderRadius: 'control',
    borderWidth: '1px',
    fontFamily: 'sans',
    fontSize: '14px',
    fontWeight: 'medium',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
    _disabled: { opacity: '0.4', cursor: 'not-allowed' }
  },
  variants: {
    variant: {
      solid: {
        bg: 'green',
        borderColor: 'green',
        color: 'onGreen',
        _hover: { bg: 'greenBright' }
      },
      outline: {
        bg: 'floating',
        borderColor: '#353437',
        color: 'ink',
        _hover: { borderColor: 'outline' }
      },
      ghost: {
        bg: 'transparent',
        borderColor: 'transparent',
        color: 'inkVariant',
        _hover: { color: 'ink', bg: 'floating' }
      }
    },
    size: {
      sm: { minH: '9', px: '3', fontSize: '13px' },
      xs: { minH: '8', px: '2.5', fontSize: '12px' }
    }
  },
  defaultVariants: { variant: 'outline' }
})
