import type { Metadata } from "next";
import ManagerApp from "./ManagerApp";

export const metadata: Metadata = {
  title: "M2GO 经理总表",
  description: "M2GO 经理专用的员工时间汇总与名单管理",
};

export default function ManagerPage() {
  return <ManagerApp />;
}
