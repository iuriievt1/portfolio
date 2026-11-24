import { cn } from '@pkg/utils'

type CardMetadataProps = { children: React.ReactNode; className?: string }

export function CardMetadata({ children, className }: CardMetadataProps) {
	return <div className={cn('absolute inset-x-card-inset bottom-card-inset space-y-1', className)}>{children}</div>
}
CardMetadata.displayName = 'Card.Metadata'
