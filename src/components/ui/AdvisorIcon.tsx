import { ChatCircleText, type IconProps } from "@phosphor-icons/react";

/** Shared conversational-guidance mark; the enclosing control supplies its label. */
export function AdvisorIcon(props: IconProps) {
  return <ChatCircleText {...props} weight="regular" aria-hidden="true" data-advisor-icon="" />;
}
