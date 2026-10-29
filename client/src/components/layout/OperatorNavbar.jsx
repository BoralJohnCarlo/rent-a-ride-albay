import NavbarActions from "./NavbarActions";
import BaseNavbar from "./BaseNavbar";

const OperatorNavbar = ({
    title = "Dashboard",
    subtitle,
    icon,
    user,
    onLogout,
    onMenuClick,
    // Replaces the desktop bell + user menu (phones pass MobileHeaderActions).
    actions,
}) => {
    return (
        <BaseNavbar
            title={title}
            subtitle={subtitle}
            icon={icon}
            onMenuClick={onMenuClick}
            actions={
                actions ?? (
                    <NavbarActions
                        user={user}
                        onLogout={onLogout}
                        notificationPath="/operator/notifications"
                    />
                )
            }
        />
    );
};

export default OperatorNavbar;