import BaseNavbar from "./BaseNavbar";

const AdminNavbar = ({
    title = "Dashboard",
    subtitle,
    icon,
    onMenuClick,
    actions,
}) => {
    return (
        <BaseNavbar
            title={title}
            subtitle={subtitle}
            icon={icon}
            onMenuClick={onMenuClick}
            actions={actions}
        />
    );
};

export default AdminNavbar;