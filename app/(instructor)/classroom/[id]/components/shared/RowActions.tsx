/**
 * RowActions renders a table row's actions as a few always-visible icon buttons
 * plus an overflow "…" menu for the rest.
 *
 * Wide instructor tables pin their actions column (see stickyActionColumn), but a
 * status can carry five or six actions, which crowds the pinned column and buries
 * the important ones. Callers split their actions into `primary` (shown inline as
 * icons) and `menu` (collapsed into a labelled dropdown), keeping only the
 * frequently-used actions on screen while the rest stay one tap away — and the
 * menu items carry text labels, which read more clearly than a wall of icons.
 */

"use client";

import { memo } from "react";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Icon } from "@iconify/react";

export type RowActionColor =
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger";

export interface RowAction {
    key: string;
    label: string;
    icon: string;
    color?: RowActionColor;
    onPress?: () => void;
    /** Renders the action as a link (opens in a new tab by default). */
    href?: string;
    target?: string;
    isDisabled?: boolean;
    /** Secondary line shown under the label in the overflow menu (e.g. why it is disabled). */
    description?: string;
    /** Extra classes for the inline icon, e.g. a status colour. */
    iconClassName?: string;
}

interface RowActionsProps {
    primary: RowAction[];
    menu: RowAction[];
    menuLabel: string;
}

function RowActionsComponent({ primary, menu, menuLabel }: RowActionsProps) {
    return (
        <div className="flex items-center justify-center gap-1">
            {primary.map((action) => {
                const icon = <Icon icon={action.icon} className={`text-xl ${action.iconClassName ?? ""}`} />;
                return (
                    <Tooltip
                        key={action.key}
                        content={action.label}
                        color={action.color === "danger" ? "danger" : "default"}
                    >
                        {action.href ? (
                            <a
                                href={action.href}
                                target={action.target ?? "_blank"}
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center rounded-lg p-2 text-default-600 hover:bg-content2"
                            >
                                {icon}
                            </a>
                        ) : (
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color={action.color}
                                isDisabled={action.isDisabled}
                                onPress={action.onPress}
                            >
                                {icon}
                            </Button>
                        )}
                    </Tooltip>
                );
            })}

            {menu.length > 0 && (
                <Dropdown>
                    <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="light" aria-label={menuLabel}>
                            <Icon icon="solar:menu-dots-bold" className="text-xl" />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        aria-label={menuLabel}
                        disabledKeys={menu.filter((action) => action.isDisabled).map((action) => action.key)}
                    >
                        {menu.map((action) => (
                            <DropdownItem
                                key={action.key}
                                color={action.color === "danger" ? "danger" : "default"}
                                className={action.color === "danger" ? "text-danger" : undefined}
                                description={action.description}
                                startContent={<Icon icon={action.icon} className="text-lg" />}
                                href={action.href}
                                target={action.href ? action.target ?? "_blank" : undefined}
                                onPress={action.href ? undefined : action.onPress}
                            >
                                {action.label}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            )}
        </div>
    );
}

export const RowActions = memo(RowActionsComponent);
export default RowActions;
