'use client'

type TitleProps = {
	title?: string
}

export function Title({ title }: TitleProps) {
	if (!title) return null
	return <p className='truncate font-bold text-sm text-white sm:text-2xl'>{title}</p>
}
