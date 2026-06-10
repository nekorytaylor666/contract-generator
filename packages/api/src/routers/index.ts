import { protectedProcedure, publicProcedure, router } from "../index";
import { adminTemplatesRouter } from "./admin-templates";
import { authRouter } from "./auth";
import { documentsRouter } from "./documents";
import { onboardingRouter } from "./onboarding";
import { paymentsRouter } from "./payments";
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
  onboarding: onboardingRouter,
  templates: templatesRouter,
  documents: documentsRouter,
  team: teamRouter,
  payments: paymentsRouter,
  adminTemplates: adminTemplatesRouter,
});
export type AppRouter = typeof appRouter;
