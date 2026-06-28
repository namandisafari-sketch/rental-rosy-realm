import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUgandaLocations } from "@/hooks/use-uganda-locations";

interface LocationSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

function parseLocation(location: string): { region: string; district: string; subcounty: string; parish: string; village: string } {
  const parts = location.split(" / ").map((s) => s.trim());
  return {
    region: parts[0] ?? "",
    district: parts[1] ?? "",
    subcounty: parts[2] ?? "",
    parish: parts[3] ?? "",
    village: parts[4] ?? "",
  };
}

export function LocationSelector({ value, onChange, label }: LocationSelectorProps) {
  const { regions, getDistricts, getSubcounties, getParishes, getVillages } = useUgandaLocations();
  const parsed = parseLocation(value);

  const [region, setRegion] = useState(parsed.region);
  const [districtName, setDistrictName] = useState(parsed.district);
  const [subcountyName, setSubcountyName] = useState(parsed.subcounty);
  const [parish, setParish] = useState(parsed.parish);
  const [village, setVillage] = useState(parsed.village);

  const districts = region ? getDistricts(region) : [];
  const subcounties = districtName
    ? getSubcounties(districts.find((d) => d.district_name === districtName)?.district_code ?? 0)
    : [];
  const parishes = districtName && subcountyName ? getParishes(districtName, subcountyName) : [];
  const villages = districtName && subcountyName && parish ? getVillages(districtName, subcountyName, parish) : [];

  const rebuild = useCallback(
    (reg: string, dist: string, sub: string, par: string, vil: string) => {
      const parts = [reg, dist, sub, par, vil].filter(Boolean);
      onChange(parts.join(" / "));
    },
    [onChange],
  );

  useEffect(() => {
    rebuild(region, districtName, subcountyName, parish, village);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, districtName, subcountyName, parish, village]);

  const handleRegionChange = (v: string) => {
    setRegion(v);
    setDistrictName("");
    setSubcountyName("");
    setParish("");
    setVillage("");
  };

  const handleDistrictChange = (v: string) => {
    setDistrictName(v);
    setSubcountyName("");
    setParish("");
    setVillage("");
  };

  const handleSubcountyChange = (v: string) => {
    setSubcountyName(v);
    setParish("");
    setVillage("");
  };

  const handleParishChange = (v: string) => {
    setParish(v);
    setVillage("");
  };

  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Region</label>
            <Select value={region} onValueChange={handleRegionChange}>
              <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">District</label>
            <Select value={districtName} onValueChange={handleDistrictChange} disabled={!region}>
              <SelectTrigger><SelectValue placeholder={region ? "Select district" : "Select region first"} /></SelectTrigger>
              <SelectContent>
                {districts.map((d) => (
                  <SelectItem key={d.district_code} value={d.district_name}>{d.district_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Subcounty / Division</label>
            <Select value={subcountyName} onValueChange={handleSubcountyChange} disabled={!districtName}>
              <SelectTrigger><SelectValue placeholder={districtName ? "Select subcounty" : "Select district first"} /></SelectTrigger>
              <SelectContent>
                {subcounties.map((s) => (
                  <SelectItem key={s.subcounty_code} value={s.subcounty_name}>{s.subcounty_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Parish / Ward</label>
            <Select value={parish} onValueChange={handleParishChange} disabled={!subcountyName}>
              <SelectTrigger><SelectValue placeholder={subcountyName ? "Select parish" : "Select subcounty first"} /></SelectTrigger>
              <SelectContent>
                {parishes.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Village / Street / Landmark</label>
          <Select value={village} onValueChange={setVillage} disabled={!parish}>
            <SelectTrigger><SelectValue placeholder={parish ? "Select village" : "Select parish first"} /></SelectTrigger>
            <SelectContent>
              {villages.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
