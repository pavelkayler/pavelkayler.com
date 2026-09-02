export function LogoSpacer({ coverSize }: { coverSize?: 'small' | 'medium' | 'large' }) {
  const spacer = <div className="logo route-logo-spacer" aria-hidden="true" />

  if (coverSize) {
    return <div className={`cover-header -${coverSize}`}>{spacer}</div>
  }

  return spacer
}
