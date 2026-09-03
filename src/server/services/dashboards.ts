import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { DEFAULT_DASHBOARD_WIDGETS, WIDGET_CATALOGUE } from "@/config/defaults";
import { db } from "@/lib/db/client";
import { dashboardWidgets, dashboards } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { assertCan, type RequestContext } from "@/server/context";
import { invalidateConfiguration } from "@/server/configuration/service";

export type WidgetRecord = {
  id: string;
  type: string;
  title: string | null;
  config: unknown;
  size: string;
  visible: boolean;
  sortOrder: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Per-user dashboards. Layouts are stored as widget rows so ordering,
 * visibility and sizing survive reloads, and administrators can curate the
 * available widget catalogue.
 */
export const dashboardService = {
  async get(ctx: RequestContext) {
    assertCan(ctx, "dashboard.view");
    const existing = await db
      .select()
      .from(dashboards)
      .where(and(eq(dashboards.userId, ctx.user.id), eq(dashboards.isDefault, true)))
      .limit(1);

    let dashboard: typeof dashboards.$inferSelect = existing[0]!;
    if (!dashboard) {
      const [created] = await db
        .insert(dashboards)
        .values({ userId: ctx.user.id, name: "My dashboard", isDefault: true })
        .returning();
      if (!created) throw AppError.badRequest("The dashboard could not be created.");
      dashboard = created;

      await db.insert(dashboardWidgets).values(
        DEFAULT_DASHBOARD_WIDGETS.map((widget, index) => ({
          dashboardId: dashboard.id,
          type: widget.type,
          title: widget.title,
          size: widget.size,
          x: widget.x,
          y: widget.y,
          w: widget.w,
          h: widget.h,
          sortOrder: index,
          visible: true,
        })),
      );
    }

    const widgets = await db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.dashboardId, dashboard.id))
      .orderBy(asc(dashboardWidgets.sortOrder));

    return { id: dashboard.id, name: dashboard.name, widgets: widgets as WidgetRecord[] };
  },

  async saveLayout(ctx: RequestContext, widgets: Array<Partial<WidgetRecord> & { id?: string; type: string }>) {
    assertCan(ctx, "dashboard.view");
    const dashboard = await this.get(ctx);

    await db.transaction(async (tx) => {
      await tx.delete(dashboardWidgets).where(eq(dashboardWidgets.dashboardId, dashboard.id));
      if (widgets.length === 0) return;
      await tx.insert(dashboardWidgets).values(
        widgets.map((widget, index) => ({
          dashboardId: dashboard.id,
          type: widget.type,
          title: widget.title ?? null,
          config: (widget.config ?? null) as never,
          size: widget.size ?? "medium",
          visible: widget.visible ?? true,
          sortOrder: widget.sortOrder ?? index,
          x: widget.x ?? 0,
          y: widget.y ?? 0,
          w: widget.w ?? 1,
          h: widget.h ?? 1,
        })),
      );
    });

    return this.get(ctx);
  },

  async addWidget(ctx: RequestContext, type: string) {
    assertCan(ctx, "dashboard.view");
    const definition = WIDGET_CATALOGUE.find((widget) => widget.type === type);
    if (!definition) throw AppError.badRequest("Unknown widget type.");
    const dashboard = await this.get(ctx);
    const maxY = dashboard.widgets.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);

    await db.insert(dashboardWidgets).values({
      dashboardId: dashboard.id,
      type,
      title: definition.label,
      size: definition.minW >= 3 ? "large" : definition.minH >= 2 ? "medium" : "small",
      x: 0,
      y: maxY,
      w: definition.minW,
      h: definition.minH,
      sortOrder: dashboard.widgets.length,
      visible: true,
    });
    return this.get(ctx);
  },

  async removeWidget(ctx: RequestContext, widgetId: string) {
    assertCan(ctx, "dashboard.view");
    const dashboard = await this.get(ctx);
    const owned = dashboard.widgets.some((widget) => widget.id === widgetId);
    if (!owned) throw AppError.notFound("This widget does not belong to your dashboard.");
    await db.delete(dashboardWidgets).where(eq(dashboardWidgets.id, widgetId));
    return this.get(ctx);
  },

  async reset(ctx: RequestContext) {
    assertCan(ctx, "dashboard.view");
    const dashboard = await this.get(ctx);
    await db.transaction(async (tx) => {
      await tx.delete(dashboardWidgets).where(eq(dashboardWidgets.dashboardId, dashboard.id));
      await tx.insert(dashboardWidgets).values(
        DEFAULT_DASHBOARD_WIDGETS.map((widget, index) => ({
          dashboardId: dashboard.id,
          type: widget.type,
          title: widget.title,
          size: widget.size,
          x: widget.x,
          y: widget.y,
          w: widget.w,
          h: widget.h,
          sortOrder: index,
          visible: true,
        })),
      );
    });
    return this.get(ctx);
  },

  catalogue(ctx: RequestContext) {
    assertCan(ctx, "dashboard.view");
    return WIDGET_CATALOGUE;
  },
};

export { invalidateConfiguration };
