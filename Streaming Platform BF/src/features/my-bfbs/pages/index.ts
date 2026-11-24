import type { ComponentType } from "react";
import type { MenuItem } from "../menu-items";
import { ContinueWatchingPage } from "./continue-watching-page";
import { DevicesPage } from "./devices-page";
import { HelpPage } from "./help-page";
import { MyListPage } from "./my-list-page";
import { PrivacyPolicyPage } from "./privacy-policy-page";
import { TermsAndConditionsPage } from "./terms-and-conditions-page";
import { TimeZonePage } from "./time-zone-page";

export const MY_BFBS_PAGES: Record<MenuItem, ComponentType> = {
  Help: HelpPage,
  "Continue Watching": ContinueWatchingPage,
  "My List": MyListPage,
  "Time Zone": TimeZonePage,
  Devices: DevicesPage,
  "Terms & Conditions": TermsAndConditionsPage,
  "Privacy Policy": PrivacyPolicyPage,
};
