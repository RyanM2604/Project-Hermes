import { Henny_Penny } from "next/font/google";
import Image from "next/image";

export default function Home() {
  return (
  <>
    <div className="absolute top-[20%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
  </>
  )
}
