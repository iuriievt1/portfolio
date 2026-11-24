import { useQuery } from "@tanstack/react-query";
import { fairplayCertificateQueryOptions } from "../playback-queries";

export function useFairplayCertificateUrl(enabled: boolean) {
  return useQuery({ ...fairplayCertificateQueryOptions(), enabled });
}
