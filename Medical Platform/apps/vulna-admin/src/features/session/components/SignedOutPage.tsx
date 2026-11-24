import { SignInIcon } from "@phosphor-icons/react"
import { cn } from "cn"
import { LOGIN_URL } from "@/api/client"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import cs from "@/i18n/cs.json"

export function SignedOutPage() {
	const texts = cs.session.signedOut
	return (
		<main className="grid min-h-svh place-items-center bg-background p-(--section-gap)">
			<Card className="w-full max-w-sm [--card-spacing:var(--section-gap)]">
				<CardContent className="flex flex-col gap-(--section-gap)">
					<p className="label-caps text-xs font-medium text-muted-foreground">{cs.app.name}</p>
					<div className="flex flex-col gap-2">
						<h1 className="text-2xl font-semibold">{texts.heading}</h1>
						<p className="text-sm text-muted-foreground">{texts.body}</p>
					</div>
					<a href={LOGIN_URL} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
						<SignInIcon aria-hidden />
						{texts.action}
					</a>
				</CardContent>
			</Card>
		</main>
	)
}
