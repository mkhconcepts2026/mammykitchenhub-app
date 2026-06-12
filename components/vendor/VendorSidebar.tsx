type Props = {
  currentTab:string;
  setCurrentTab:(tab:any)=>void;
  vendorName:string;
  logout:()=>void;
};

export default function VendorSidebar({
  currentTab,
  setCurrentTab,
  vendorName,
  logout
}:Props){

  const navItem = (
    tab:string,
    label:string
  ) => (

    <button
      onClick={()=>
        setCurrentTab(tab)
      }
      className={`
        w-full
        text-left
        px-5
        py-4
        rounded-2xl
        font-medium
        transition

        ${
          currentTab === tab
          ? "bg-orange-500 text-white"
          : "text-gray-700 hover:bg-gray-100"
        }
      `}
    >
      {label}
    </button>

  );

  return(

    <aside
      className="
        w-72
        bg-white
        min-h-screen
        border-r
        flex
        flex-col
        justify-between
        p-6
      "
    >

      <div>

        <h2
          className="
            text-3xl
            font-bold
            mb-2
          "
        >
          {vendorName}
        </h2>

        <p
          className="
            text-gray-500
            mb-10
          "
        >
          Vendor Dashboard
        </p>

        <div className="space-y-3">

          {navItem(
            "dashboard",
            "Dashboard"
          )}

          {navItem(
            "orders",
            "Orders"
          )}

          {navItem(
            "menu",
            "Menu"
          )}

          {navItem(
            "earnings",
            "Earnings"
          )}

          {navItem(
            "kyc",
            "KYC Verification"
          )}

        </div>

      </div>

    

    </aside>

  );

}