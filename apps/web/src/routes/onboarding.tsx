import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUser } from "@/functions/get-user";
import { getUserOrganizations } from "@/functions/get-user-organizations";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingComponent,
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({
        to: "/login",
      });
    }

    const { organizations } = await getUserOrganizations();

    if (organizations.length > 0) {
      throw redirect({
        to: "/dashboard",
      });
    }

    return { session: context.session };
  },
});

function OnboardingComponent() {
  const navigate = useNavigate();
  const { session } = Route.useRouteContext();

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
    },
    onSubmit: async ({ value }) => {
      const result = await authClient.organization.create({
        name: value.name,
        slug: value.slug,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to create organization");
        return;
      }

      toast.success("Organization created successfully");
      navigate({ to: "/dashboard" });
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .min(2, "Organization name must be at least 2 characters"),
        slug: z
          .string()
          .min(2, "Slug must be at least 2 characters")
          .regex(
            /^[a-z0-9-]+$/,
            "Slug can only contain lowercase letters, numbers, and hyphens"
          ),
      }),
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-2 text-center font-bold text-3xl">
        Welcome, {session?.user.name}!
      </h1>
      <p className="mb-6 text-center text-muted-foreground">
        Create your first organization to get started.
      </p>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div>
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Organization Name</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    const currentSlug = form.getFieldValue("slug");
                    if (
                      !currentSlug ||
                      currentSlug === generateSlug(field.state.value)
                    ) {
                      form.setFieldValue("slug", generateSlug(e.target.value));
                    }
                  }}
                  placeholder="Acme Inc."
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-red-500 text-sm" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="slug">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Organization Slug</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(e.target.value.toLowerCase())
                  }
                  placeholder="acme-inc"
                  value={field.state.value}
                />
                <p className="text-muted-foreground text-xs">
                  This will be used in URLs and must be unique.
                </p>
                {field.state.meta.errors.map((error) => (
                  <p className="text-red-500 text-sm" key={error?.message}>
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <form.Subscribe>
          {(state) => (
            <Button
              className="w-full"
              disabled={!state.canSubmit || state.isSubmitting}
              type="submit"
            >
              {state.isSubmitting ? "Creating..." : "Create Organization"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
