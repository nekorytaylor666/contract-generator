import { protectedProcedure, publicProcedure, router } from "../index";
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
  templates: templatesRouter,
});
export type AppRouter = typeof appRouter;
