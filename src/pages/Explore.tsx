import { Compass } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";
import { RimoraShell } from "@/components/RimoraShell";

const Explore = () => (
	<RimoraShell>
		<div className="page-container max-w-4xl space-y-8">
			<header className="flex items-center gap-4">
				<div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
					<Compass className="h-6 w-6" />
				</div>
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
						The public shelf
					</p>
					<h1 className="font-display text-4xl font-semibold">Explore</h1>
				</div>
			</header>
			<ComingSoon
				title="Explore is coming soon"
				description="Discover stories, translators, genres, and new worlds when the public shelf is ready."
			/>
		</div>
	</RimoraShell>
);
export default Explore;