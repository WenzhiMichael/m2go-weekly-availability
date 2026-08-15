import type { Metadata } from "next";
import ScheduleApp from "./ScheduleApp";

export const metadata: Metadata = {
  title: "M2GO 每周可上班时间",
  description: "M2GO 全员共用的每周可上班时间表",
};

export default function Home() {
  return <ScheduleApp />;
}
