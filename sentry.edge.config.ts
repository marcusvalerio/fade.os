import * as Sentry from "@sentry/nextjs";
import { opcoesDoSentry } from "@/lib/observabilidade";

Sentry.init(opcoesDoSentry());
