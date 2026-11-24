import { cn } from '@pkg/utils'

type CardOuterMetaProps = { children: React.ReactNode; className?: string }

export function CardOuterMeta({ children, className }: CardOuterMetaProps) {
	return <div className={cn('mt-card-outer-top space-y-card-outer-gap', className)}>{children}</div>
}
CardOuterMeta.displayName = 'Card.OuterMeta'
