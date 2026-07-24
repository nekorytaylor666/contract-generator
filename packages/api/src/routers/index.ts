import { protectedProcedure, publicProcedure, router } from "../index";
import { accountRouter } from "./account";
import { adminRouter } from "./admin";
import { adminTemplatesRouter } from "./admin-templates";
import { authRouter } from "./auth";
import { counterpartiesRouter } from "./counterparties";
import { documentsRouter } from "./documents";
import { onboardingRouter } from "./onboarding";
import { paymentsRouter } from "./payments";
import { requisitesRouter } from "./requisites";
import { subscriptionsRouter } from "./subscriptions";
import { teamRouter } from "./team";
import { templatesRouter } from "./templates";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  auth: authRouter,
  account: accountRouter,
  onboarding: onboardingRouter,
  templates: templatesRouter,
  documents: documentsRouter,
  team: teamRouter,
  payments: paymentsRouter,
  requisites: requisitesRouter,
  counterparties: counterpartiesRouter,
  subscriptions: subscriptionsRouter,
  adminTemplates: adminTemplatesRouter,
  admin: adminRouter,
});
export type AppRouter = typeof appRouter;
